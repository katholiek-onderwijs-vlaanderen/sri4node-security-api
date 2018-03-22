const util = require('util');
const urlModule = require('url');
const _ = require('lodash');
const pMemoize = require('p-memoize');
const pReduce = require('p-reduce');
const request = require('requestretry');

const { SriError, debug, typeToMapping, getPersonFromSriRequest } = require('sri4node/js/common.js')

const memRequest = pMemoize(request, {maxAge: 5*60*1000}); // cache raw requests for 5 minutes

var utils = require('./utils');

exports = module.exports = function (pluginConfig, sriConfig) {

  'use strict';

  const sri4nodeUtils = sriConfig.utils



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
      sri4nodeUtils.convertListResourceURLToSQL(typeToMapping(rawUrl.pathname), rawUrl.query, false, tx, query)
      query.sql(' AND \"key\" IN (').array(keys).sql(')');

      const rows = await sri4nodeUtils.executeSQL(tx, query)
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


  async function doSecurityRequest(url) {
    try {
      debug(`Querying security at: ${url}`)

      const res = await memRequest({url: url, auth: pluginConfig.auth, headers: pluginConfig.headers, json:true})
      if (res.statusCode!=200) {
        throw `security request returned unexpected status ${res.statusCode}: ${util.inspect(res.body)}`
      }
      return res.body
    } catch (error) {
      console.log('____________________________ E R R O R ____________________________________________________') 
      console.log(error)
      console.log('___________________________________________________________________________________________') 
      throw new SriError({status: 503, errors: [{ code: 'security.unavailable',  msg: 'Retrieving security information failed.' }]})
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
    const url = pluginConfig.securityApiBase + '/security/query/resources/raw?component=' + component
                  + '&ability=' + operation
                  + '&person=' + getPersonFromSriRequest(sriRequest);
    // an optimalisation might be to be able to skip ability parameter and cache resources raw for all abilities together
    // (needs change in security API)

    const resourcesRaw = await doSecurityRequest(url)


    const relevantRawResources = resourcesRaw.filter( rawEntry => (utils.getResourceFromUrl(rawEntry) === resourceType) )

    const superUserResource = resourceType + (sriRequest.containsDeleted ? '?$$meta.deleted=any' : '')
    if (relevantRawResources.includes(superUserResource)) {
      return true
    }

    const keys = elements.map( element => utils.getKeyFromPermalink(element.permalink) )
    debug('relevantRawResources:')
    debug(relevantRawResources)
    const keysNotMatched = await pReduce(relevantRawResources, async (keysNeeded, rawEntry) => {
        debug('NEEDED KEYS:')
        debug(keysNeeded)

      if (keysNeeded.length > 0) {
        const matchedkeys = await (checkRawResourceForKeys(tx, rawEntry, keysNeeded))
        debug('MATCHED KEYS:')
        debug(matchedkeys)
        return keysNeeded.filter( k => !matchedkeys.includes(k) )
      } else {
        return []
      }
    }, keys)

    if (keysNotMatched.length > 0) {
      debug(`keysNotMatched: ${keysNotMatched}`)
      handleNotAllowed(sriRequest)
    }
  }

  async function customCheck(component, tx, sriRequest, ability, resource) {
    const url = pluginConfig.securityApiBase + '/security/query/allowed?component=' + component
                  + '&person=' + getPersonFromSriRequest(sriRequest)
                  + '&ability=' + ability
                  + (resource !== undefined ? '&resource=' + resource : '');
    const result = await doSecurityRequest(url)

    if (result !== true) {
      debug(`not allowed`)
      handleNotAllowed(sriRequest)
    }
  }

  return { 
    checkPermissionOnElements,
    customCheck,
    handleNotAllowed
  }

};
