const util = require('util');
const urlModule = require('url');
const _ = require('lodash');
const pMemoize = require('p-memoize');
const pReduce = require('p-reduce');

const { SriError, debug, error, typeToMapping, getPersonFromSriRequest, tableFromMapping, urlToTypeAndKey } = require('sri4node/js/common.js')

var utils = require('./utils');

exports = module.exports = function (pluginConfig, sriConfig) {

  'use strict';

  const sri4nodeUtils = sriConfig.utils

  const configuration = {
    baseUrl: pluginConfig.securityApiBase,
    headers: pluginConfig.headers,
    username: pluginConfig.auth.user, 
    password: pluginConfig.auth.pass,
    accessToken: pluginConfig.accessToken
  }

  const api = require('@kathondvla/sri-client/node-sri-client')(configuration)
  const memGet = pMemoize(api.get, {maxAge: 5*60*1000}); // cache requests for 5 minutes
  const memPut = pMemoize(api.put, {maxAge: 5*60*1000}); // cache requests for 5 minutes

  let memResourcesRawInternal = null;

  const setMemResourcesRawInternal = (func) => {
    memResourcesRawInternal = func;
  }

  let mergeRawResourcesFun = null;

  const setMergeRawResourcesFun = (func) => {
    mergeRawResourcesFun = func;
  }

  const checkRawResourceForKeys = async (tx, rawEntry, keys) => {
    if (utils.isPermalink(rawEntry)) {
      const permalinkKey = utils.getKeyFromPermalink(rawEntry)
      if (keys.includes(permalinkKey)) {
        return [ permalinkKey ]
      } else {
        return []
      }
    } else {
      const rawUrl = urlModule.parse(rawEntry, true);
      const query = sri4nodeUtils.prepareSQL('check-resource-exist');

      // there is no guarantee that the group is mapped in the database      
      
      const mapping = typeToMapping(rawUrl.pathname);
      const parameters = _.cloneDeep(rawUrl.query);
      parameters.expand = 'none';
      await sri4nodeUtils.convertListResourceURLToSQL(mapping, parameters, false, tx, query)
      query.sql(' AND \"' + tableFromMapping(mapping) +'\".\"key\" IN (').array(keys).sql(')');
      
      const start = new Date();

      const rows = await sri4nodeUtils.executeSQL(tx, query)
      debug('sri4node-security-api | security db check, securitydb_time='+(new Date() - start)+' ms.')
      return rows.map( r => r.key )  // TODO: verify
    }
  }

  const beforePhaseHook = async (sriRequestMap, jobMap, pendingJobs) => {
    // collect all keys to check from pending jobs
    const relevantSriRequests = Array.from(sriRequestMap)
                                    .filter( ([psId, sriRequest]) => pendingJobs.has(psId) );

    const keysNeeded = [];
    const rawMap = relevantSriRequests
                      .reduce( (rawMap, [psId, sriRequest]) => {
      if (sriRequest.keysToCheckBySecurityPlugin) {
        const { keys, relevantRawResources } = sriRequest.keysToCheckBySecurityPlugin
        keysNeeded.push(...keys);
        relevantRawResources.forEach( u => {
          if (rawMap.get(u) !== undefined) {
            rawMap.get(u).keys.push(...keys);
          } else {
            rawMap.set(u, { keys, sriRequest })
          }
        })
      }
      return rawMap;
    }, new Map() );

    // verify them with local queries
    const keysNotMatched = await pReduce(rawMap.keys(), async (keysNeeded, rawEntry) => {
      if (keysNeeded.length > 0) {
        const { keys, sriRequest } = rawMap.get(rawEntry);
        const matchedkeys = await (checkRawResourceForKeys(sriRequest.dbT, rawEntry, keys))
        return _.filter(keysNeeded, k => !matchedkeys.includes(k) )
      } else {
        return []
      }
    }, keysNeeded);

    if (keysNotMatched.length > 0) {
      debug(`sri4node-security-api | keysNotMatched: ${keysNotMatched}`)

      relevantSriRequests.forEach( ([psId, sriRequest]) => {
        if (sriRequest.keysToCheckBySecurityPlugin && _.intersection(sriRequest.keysToCheckBySecurityPlugin.keys, keysNotMatched).length > 0) {
          // this sriRequest has keys wich are not matched by the rawUrls recevied from security
          try {
            handleNotAllowed(sriRequest);
          } catch (err) {
            if (err instanceof SriError) {
              jobMap.get(psId).jobEmitter.emit('ready', err);
            } else {
              throw err;
            }
          }
        } else {
          // this sriRequest has no keys wich are not matched by the rawUrls recevied from security => security check succeede
          sriRequest.keysToCheckBySecurityPlugin = undefined;
        }
      });
    }
  }


  function handleNotAllowed(sriRequest) {
      // Notify the oauthValve that the current request is forbidden. The valve might act
      // according to this information by throwing an SriError object (for example a redirect to a 
      // login page or an error in case of a bad authentication token). 
      pluginConfig.oauthValve.handleForbiddenBySecurity(sriRequest)

      // If the valve did not throw an SriError, the default response 403 Forbidden is returned.
      throw new SriError({status: 403})    
  }

  async function doSecurityRequest(batch) {
    try {
      const res = await memPut('/security/query/batch', batch);
      if (res.some( r => (r.status != 200) )) {
        debug('_______________________________________________________________')
        debug(batch)
        debug('-----')
        debug(res)
        debug('_______________________________________________________________')
        throw 'unexpected.status.in.batch.result'
      }
      return res.map( r => r.body )
    } catch (err) {
      error('____________________________ E R R O R ____________________________________________________') 
      error(err)
      error(JSON.stringify(err))
      error('___________________________________________________________________________________________') 
      throw new SriError({status: 503, errors: [{ code: 'security.request.failed',  msg: 'Retrieving security information failed.' }]})
    }    
  }

  async function checkPermissionOnElements(component, tx, sriRequest, elements, operation) {
    const resourceTypes = _.uniq(elements.map( e => utils.getResourceFromUrl(e.permalink) ))

    if (resourceTypes.length > 1) {
      // Do not allow mixed resource output. Does normally not occur.
      error(`ERR: Mixed resource output:`)
      error(elements)
      throw new SriError({status: 403})
    }

    const [ resourceType ] = resourceTypes
    let resourcesRaw;
    if (memResourcesRawInternal!==null) {
      resourcesRaw = await memResourcesRawInternal(sriRequest, tx, component, operation, getPersonFromSriRequest(sriRequest));
    } else {
      const url = '/security/query/resources/raw?component=' + component
                    + '&ability=' + operation
                    + '&person=' + getPersonFromSriRequest(sriRequest);
      // an optimalisation might be to be able to skip ability parameter and cache resources raw for all abilities together
      // (needs change in security API)
      
      const start = new Date();
      
      ([ resourcesRaw ] = await doSecurityRequest([{ href: url, verb: 'GET' }]));
      debug('sri4node-security-api | response security, securitytime='+(new Date() - start)+' ms.')
    }

    let relevantRawResources = _.filter(resourcesRaw, rawEntry => (utils.getResourceFromUrl(rawEntry) === resourceType) )

    const superUserResource = resourceType + (sriRequest.containsDeleted ? '?$$meta.deleted=any' : '')
    if (relevantRawResources.includes(superUserResource)) {
      return true
    }

    const keys = elements.map( element => utils.getKeyFromPermalink(element.permalink) )

    if (mergeRawResourcesFun !== null) {
        // Applications have the possibility to pass a function to merge some of the resources in the relevantRawResources
        // list in combined raw resources. This way, the length of the relevantRawResources list can be reduced, which 
        // results in faster security checks.
        // This needs to be done by the application as only the application knows which resources can be combined.
        relevantRawResources = mergeRawResourcesFun(relevantRawResources);
    }
   
    // store keys and relevantRawResources, they will be checked by the beforePhaseHook of this plugin
    sriRequest.keysToCheckBySecurityPlugin = { keys, relevantRawResources };
  }

  async function allowedCheckBatch(tx, sriRequest, elements) {
    const batch = elements.map( ({component, resource, ability}) => {
                            if (component === null) throw new SriError({status: 403})  
                            const url = '/security/query/allowed?component=' + component
                                          + '&person=' + getPersonFromSriRequest(sriRequest)
                                          + '&ability=' + ability
                                          + (resource !== undefined ? '&resource=' + resource : '');
                            return { href: url, verb: 'GET' }
                        })
    const result = await doSecurityRequest(batch)

    const notAllowedIndices = []
    result.forEach( (e, idx) => {
        if (e !== true) { notAllowedIndices.push(idx) }
    })    

    if (notAllowedIndices.length > 0) {
      // In the case where the resource does not exist in the database anymore (e.g. after physical delete)
      // or the in case of a create which is not yet synced in the security server
      // the isAllowed() check fails even for superuser.
      // ==> check wether the user has the required superuser rights 
      const toCheck = _.uniqWith( notAllowedIndices.map( (idx) => {
                const {component, resource, ability} = elements[idx];
                const { type } = urlToTypeAndKey(resource)
                return {component, type, ability}
              } ), _.isEqual )

      const rawBatch = toCheck.map( ({component, type, ability}) => {
                                    const url = '/security/query/resources/raw?component=' + component
                                                  + '&person=' + getPersonFromSriRequest(sriRequest)
                                                  + '&ability=' + ability;
                                    return { href: url, verb: 'GET' }
                                })

      const rawResult = await doSecurityRequest(rawBatch)

      if (rawResult.some( (e, idx) => {
          let rawRequired = toCheck[idx].type 
          if (toCheck[idx].ability === 'read') {
            // $$meta.deleted=any is only required in case of ability 'read'
            rawRequired += sriRequest.containsDeleted ? '?$$meta.deleted=any' : ''
          }
          return ! e.includes(rawRequired) 
        } )) {
        debug(`sri4node-security-api | not allowed`)
        handleNotAllowed(sriRequest)
      }
    }
  }

  function getBaseUrl() {
    return configuration.baseUrl;
  }

  return { 
    checkPermissionOnElements,
    allowedCheckBatch,
    handleNotAllowed,
    setMemResourcesRawInternal,
    setMergeRawResourcesFun,
    beforePhaseHook,
    getBaseUrl
  }

};
