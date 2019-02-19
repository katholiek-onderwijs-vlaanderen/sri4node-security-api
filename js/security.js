const util = require('util');
const urlModule = require('url');
const _ = require('lodash');
const pMemoize = require('p-memoize');
const pReduce = require('p-reduce');

const { SriError, debug, typeToMapping, getPersonFromSriRequest, tableFromMapping, urlToTypeAndKey } = require('sri4node/js/common.js')

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
        console.log('_______________________________________________________________')
        console.log(batch)
        console.log('-----')
        console.log(res)
        console.log('_______________________________________________________________')
        throw 'unexpected.status.in.batch.result'
      }
      return res.map( r => r.body )
    } catch (error) {
      console.log('____________________________ E R R O R ____________________________________________________') 
      console.log(error)
      console.log('___________________________________________________________________________________________') 
      throw new SriError({status: 503, errors: [{ code: 'security.request.failed',  msg: 'Retrieving security information failed.' }]})
    }    
  }

  async function checkPermissionOnElements(component, tx, sriRequest, elements, operation) {
    const resourceTypes = _.uniq(elements.map( e => utils.getResourceFromUrl(e.permalink) ))

    if (resourceTypes.length > 1) {
      // Do not allow mixed resource output. Does normally not occur.
      console.log(`ERR: Mixed resource output:`)
      console.log(elements)
      throw new SriError({status: 403})
    }

    const [ resourceType ] = resourceTypes
    const url = '/security/query/resources/raw?component=' + component
                  + '&ability=' + operation
                  + '&person=' + getPersonFromSriRequest(sriRequest);
    // an optimalisation might be to be able to skip ability parameter and cache resources raw for all abilities together
    // (needs change in security API)
    
    const start = new Date();
    
    const [ resourcesRaw ] = await doSecurityRequest([{ href: url, verb: 'GET' }])
    debug('sri4node-security-api | response security, securitytime='+(new Date() - start)+' ms.')

    const relevantRawResources = _.filter(resourcesRaw, rawEntry => (utils.getResourceFromUrl(rawEntry) === resourceType) )

    const superUserResource = resourceType + (sriRequest.containsDeleted ? '?$$meta.deleted=any' : '')
    if (relevantRawResources.includes(superUserResource)) {
      return true
    }

    const keys = elements.map( element => utils.getKeyFromPermalink(element.permalink) )
    const keysNotMatched = await pReduce(relevantRawResources, async (keysNeeded, rawEntry) => {
      if (keysNeeded.length > 0) {
        const matchedkeys = await (checkRawResourceForKeys(tx, rawEntry, keysNeeded))
        return _.filter(keysNeeded, k => !matchedkeys.includes(k) )
      } else {
        return []
      }
    }, keys)

    if (keysNotMatched.length > 0) {
      debug(`sri4node-security-api | keysNotMatched: ${keysNotMatched}`)
      handleNotAllowed(sriRequest)
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


  return { 
    checkPermissionOnElements,
    allowedCheckBatch,
    handleNotAllowed
  }

};
