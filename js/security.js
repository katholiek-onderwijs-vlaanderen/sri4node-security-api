const util = require('util');
const urlModule = require('url');
const _ = require('lodash');
const pMemoize = require('p-memoize');
const pMap = require('p-map');
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
  const memPut = pMemoize(api.put, {maxAge: 5*60*1000}); // cache requests for 5 minutes

  let memResourcesRawInternal = null;

  const setMemResourcesRawInternal = (func) => {
    memResourcesRawInternal = func;
  }

  let mergeRawResourcesFun = null;

  const setMergeRawResourcesFun = (func) => {
    mergeRawResourcesFun = func;
  }

  const beforePhaseHook = async (sriRequestMap, jobMap, pendingJobs) => {
        // pass all pending sriRequests as list to checkKeysAgainstDatabase
        const relevantSriRequests = Array.from(sriRequestMap)
            .filter(([psId, _sriRequest]) => pendingJobs.has(psId))
            .map(([_psId, sriRequest]) => sriRequest);
        if (relevantSriRequests.length > 0) {
            return checkKeysAgainstDatabase(relevantSriRequests);
        }
  }

  const checkKeysAgainstDatabase = async (relevantSriRequests) => {
        const map = {};
        const tx = relevantSriRequests[0].dbT;

        relevantSriRequests
            .forEach(sriRequest => {
                if (sriRequest.keysToCheckBySecurityPlugin) {
                    const { keys, relevantRawResources, ability } = sriRequest.keysToCheckBySecurityPlugin;
                    const resourceType = utils.parseResource(sriRequest.originalUrl).base;
                    const keyStr = JSON.stringify({ resourceType, ability });
                    let subMap;
                    if (map[keyStr] === undefined) {
                        map[keyStr] = {};
                    }
                    subMap = map[keyStr];

                    relevantRawResources.forEach(u => {
                        if (subMap[u] === undefined) {
                            subMap[u] = { keys: [], sriRequests: [] };
                        }
                        subMap[u].keys.push(...keys);
                        subMap[u].sriRequests.push(sriRequest);
                    })
                }
            });

        await pMap(Object.keys(map), async keyStr => {
            console.log(`Checking security for ${keyStr}`);
            const subMap = map[keyStr];


            const query = sri4nodeUtils.prepareSQL('sri4node-security-api-composed-check');

            const allKeys = _.uniq(_.flatten(Object.keys(subMap).map(u => subMap[u].keys)));

            query.sql(`SELECT distinct ck.key FROM
                   (VALUES ${allKeys.map(k => `('${k}'::uuid)`).join()}) as ck (key)
                   LEFT JOIN (`);

            await pMap(Object.keys(subMap), async (u, idx) => {
                const rawUrl = urlModule.parse(u, true);
                const mapping = typeToMapping(rawUrl.pathname);
                const parameters = _.cloneDeep(rawUrl.query);
                parameters.expand = 'none';
                try {
                    const sub_query = sri4nodeUtils.prepareSQL('sri4node-security-api-sub-check');
                    await sri4nodeUtils.convertListResourceURLToSQL(mapping, parameters, false, tx, sub_query);

                    if (idx > 0) {
                        query.sql('\nUNION ALL\n');
                    }
                    query.sql('(').appendQueryObject(sub_query).sql(')');
                } catch (err) {
                    console.warn(`IGNORING erroneous raw resource received from security server: ${u}:`);
                    console.warn(JSON.stringify(err, null, 2));
                    console.warn('Check the configuration at the security server!');
                }
            }, { concurrency: 1 })

            query.sql(`) sriq 
                   ON sriq.key = ck.key
                   WHERE sriq.key IS NULL;`);

            const start = new Date();
            const keysNotMatched = (await sri4nodeUtils.executeSQL(tx, query)).map(r => r.key);
            debug('sri4node-security-api | security db check, securitydb_time=' + (new Date() - start) + ' ms.')

            if (keysNotMatched.length > 0) {
                debug(`sri4node-security-api | keysNotMatched: ${keysNotMatched}`)
            }

            relevantSriRequests.forEach( sriRequest => {
                if (sriRequest.keysToCheckBySecurityPlugin && _.intersection(sriRequest.keysToCheckBySecurityPlugin.keys, keysNotMatched).length > 0) {
                    // this sriRequest has keys which are not matched by the rawUrls received from security
                    handleNotAllowed(sriRequest);
                } else {
                    // this sriRequest has no keys which are not matched by the rawUrls received from security => security check succeed
                    sriRequest.keysToCheckBySecurityPlugin = undefined;
                }
            });
        }, { concurrency: 1 });
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

  async function checkPermissionOnElements(component, tx, sriRequest, elements, operation, immediately=false) {
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

    const superUserResource = resourceType;
    const superUserResourceInclDeleted = resourceType + '?$$meta.deleted=any';
    if (sriRequest.containsDeleted) {
        if (relevantRawResources.includes(superUserResourceInclDeleted)) {
            return true
        }
    } else {
        if (relevantRawResources.includes(superUserResource) || relevantRawResources.includes(superUserResourceInclDeleted)) {
            return true
        }
    }

    const keys = elements.map( element => utils.getKeyFromPermalink(element.permalink) )

    if (mergeRawResourcesFun !== null) {
        // Applications have the possibility to pass a function to merge some of the resources in the relevantRawResources
        // list in combined raw resources. This way, the length of the relevantRawResources list can be reduced, which 
        // results in faster security checks.
        // This needs to be done by the application as only the application knows which resources can be combined.
        relevantRawResources = mergeRawResourcesFun(relevantRawResources);
    }
   
    // In case no keys need to be checked for security are found, nothing needs to be done.
    if (keys.length>0) {
        if (relevantRawResources.length===0) {
        // This request has keys for which permission is required but no relevant resources 
        //  --> obviously we can already disallow the request without any database check.
            handleNotAllowed(sriRequest);
        } else {
            // store keys and relevantRawResources, they will be checked by the beforePhaseHook of this plugin
            sriRequest.keysToCheckBySecurityPlugin = { keys, relevantRawResources, ability: operation };

            if (immediately) {
                await checkKeysAgainstDatabase([sriRequest]);
            }
        }
    }
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
