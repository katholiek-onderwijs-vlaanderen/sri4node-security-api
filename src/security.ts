import * as _ from 'lodash';
import { TPluginConfig, TSriConfig, TSriRequest } from 'sri4node';
const util = require('util');
const urlModule = require('url');
const pMap = require('p-map');
const pEvery = require('p-every');
const memoized = require('mem');

const SriClientError = require('@kathondvla/sri-client/sri-client-error');

const utils = require('./utils');


const getPersonFromSriRequest = (sriRequest) => {
  // A userObject of null happens when the user is (not yet) logged in
  return (sriRequest.userObject ? '/persons/' + sriRequest.userObject.uuid : 'NONE');
};

/**
 * 
 * @param {*} pluginConfig 
 * @param {*} sriConfig 
 * @param {*} sri4node the current sri4node instance as passed into the install function by sri4node
 * @returns 
 */
function securityHandler(pluginConfig:TPluginConfig, sriConfig:TSriConfig, sri4node) {

  'use strict';

  const { SriError, debug, error, utils: sri4nodeUtils } = sri4node;
  const { parseResource, typeToMapping, urlToTypeAndKey } = sri4node.utils;


  // const sri4nodeUtils = sriConfig.utils

  const securityConfiguration = {
    baseUrl: pluginConfig.securityApiBase,
    headers: pluginConfig.headers,
    username: (pluginConfig.auth as Record<string, string>).user,
    password: (pluginConfig.auth as Record<string, string>).pass,
    accessToken: pluginConfig.accessToken
  }

  const securityApi = require('@kathondvla/sri-client/node-sri-client')(securityConfiguration)
  const memPut = memoized(securityApi.put.bind(securityApi), {
    maxAge: 5 * 60 * 1000, // cache requests for 5 minutes
    cacheKey: args => JSON.stringify(args),
  });

  const apiConfiguration = {
    baseUrl: pluginConfig.apiBase,
    headers: pluginConfig.headers,
    username: (pluginConfig.auth as Record<string, string>).user,
    password: (pluginConfig.auth as Record<string, string>).pass,
    accessToken: pluginConfig.accessToken
  };

  (apiConfiguration.headers as Record<string, string>)['Content-type'] = 'application/json; charset=utf-8';

  const api = require('@kathondvla/sri-client/node-sri-client')(apiConfiguration)
  const apiPost = memoized(api.post.bind(api), {
    maxAge: 5 * 60 * 1000, // cache requests for 5 minutes
    cacheKey: args => JSON.stringify(args),
  });



  let memResourcesRawInternal;

  const setMemResourcesRawInternal = (func) => {
    memResourcesRawInternal = func;
  }

  let mergeRawResourcesFun;

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

  const rawUrlToKeySet = async (rawUrlStr, tx) => {
    debug('sri-security', `rawUrlToKeySet ${rawUrlStr}`)
    const rawUrl = urlModule.parse(rawUrlStr, true);
    const mapping = typeToMapping(rawUrl.pathname);
    const parameters = _.cloneDeep(rawUrl.query);
    parameters.expand = 'none';
    try {
      const query = sri4nodeUtils.prepareSQL('sri4node-security-api-check');
      await sri4nodeUtils.convertListResourceURLToSQL(mapping, parameters, false, tx, query);

      const start = Date.now();
      const keySet = new Set((await sri4nodeUtils.executeSQL(tx, query)).map(r => r.key));
      debug('sri-security', 'security db check, securitydb_time=' + (Date.now() - start) + ' ms.')

      return keySet;
    } catch (err) {
      console.warn(`IGNORING erroneous raw resource received from security server: ${rawUrlStr}:`);
      console.warn(err);
      console.warn(JSON.stringify(err, null, 2));
      console.warn('Check the configuration at the security server!');
      return new Set();
    }
  }

  const memoizedRawUrlToKeySet = memoized(rawUrlToKeySet, { cacheKey: args => args[0] });

  const rawUrlListToKeySet = async (rawUrlList, tx) => {
    debug('sri-security', `rawUrlListToKeySet ${rawUrlList}`)
    const query = sri4nodeUtils.prepareSQL('sri4node-security-api-composed-check');
    query.sql(`SELECT distinct sriq.key FROM (`);

    await pMap(rawUrlList, async (u, idx) => {
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

    query.sql(`) sriq;`);

    const start = Date.now();
    const keySet = new Set((await sri4nodeUtils.executeSQL(tx, query)).map(r => r.key));
    debug('sri-security', 'security db check, securitydb_time=' + (Date.now() - start) + ' ms.')

    return keySet;
  }

  const memoizedRawUrlListToKeySet = memoized(rawUrlListToKeySet, { cacheKey: args => args[0].join('|') });

  const clearRawUrlCaches = () => {
    debug('sri-security', '** cleaning rawUrl caches **')
    memoized.clear(memoizedRawUrlToKeySet);
    memoized.clear(memoizedRawUrlListToKeySet);
  }

  const checkKeysAgainstDatabase = async (relevantSriRequests) => {
    const map = {};
    const tx = relevantSriRequests[0].dbT;

    relevantSriRequests
      .forEach(sriRequest => {
        if (sriRequest.keysToCheckBySecurityPlugin) {
          const { keys, relevantRawResources, ability } = sriRequest.keysToCheckBySecurityPlugin;
          const resourceType = parseResource(sriRequest.originalUrl).base;
          const keyStr = JSON.stringify({ resourceType, ability });
          if (map[keyStr] === undefined) {
            map[keyStr] = {};
          }
          const subMap = map[keyStr];

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
      const start = Date.now();
      const subMap = map[keyStr];
      const rawUrlList = Object.keys(subMap);
      const allKeys = _.uniq(_.flatten(rawUrlList.map(u => subMap[u].keys)));
      const { ability } = JSON.parse(keyStr);

      let keysNotMatched;

      if (ability === 'read' && pluginConfig.securityDbCheckMethod === 'CacheRawListResults') {
        const rawKeySet = await memoizedRawUrlListToKeySet(rawUrlList, tx);
        keysNotMatched = allKeys.filter(k => !rawKeySet.has(k));
      } else if (ability === 'read' && pluginConfig.securityDbCheckMethod === 'CacheRawResults') {

        const union = function (iterables) {
          const set = new Set();
          for (const iterable of iterables) {
            for (const item of iterable) {
              set.add(item);
            }
          }
          return set;
        }

        const rawKeySetList = await pMap(rawUrlList, u => memoizedRawUrlToKeySet(u, tx), { concurrency: 5 });
        const rawKeySet = union(rawKeySetList);
        keysNotMatched = allKeys.filter(k => !rawKeySet.has(k));
      } else {
        const query = sri4nodeUtils.prepareSQL('sri4node-security-api-composed-check');
        // Default no caching raw urls in memory = backwards compatible.
        //  => check every time with one composed query at the db which keys don't match the raw urls.
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

        const startQuery = Date.now();
        keysNotMatched = (await sri4nodeUtils.executeSQL(tx, query)).map(r => r.key);
        debug('sri-security', 'security db check, security query time=' + (Date.now() - startQuery) + ' ms.')
      }

      if (keysNotMatched.length > 0) {
        debug('sri-security', `keysNotMatched: ${keysNotMatched}`)
      }

      if (relevantSriRequests.length === 1) {
        relevantSriRequests[0].securityHandling = `db_check (${(Date.now() - start)}ms)`;
      }

      relevantSriRequests.forEach(sriRequest => {
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
    // Notify the oauthPlugin that the current request is forbidden. The oauth plugin might act
    // according to this information by throwing an SriError object (for example a redirect to a
    // login page or an error in case of a bad authentication token).
    (pluginConfig.oauthPlugin as any).handleForbiddenBySecurity(sriRequest)

    // If the valve did not throw an SriError, the default response 403 Forbidden is returned.
    throw new SriError({ status: 403, sriRequestID: sriRequest.id })
  }

  async function doSecurityRequest(batch, sriRequest):Promise<Array<Record<string, any> | boolean>> {
    try {
      const start = Date.now();
      const res = await memPut('/security/query/batch', batch);
      if (res.some(r => (r.status != 200))) {
        debug('sri-security', '_______________________________________________________________')
        debug('sri-security', batch)
        debug('sri-security', '-----')
        debug('sri-security', res)
        debug('sri-security', '_______________________________________________________________')
        throw 'unexpected.status.in.batch.result'
      }
      const fetchTime = Date.now() - start;
      sriRequest.sriSecurityTimeToFetchRawResources = sriRequest.sriSecurityTimeToFetchRawResources !== undefined ?
        sriRequest.sriSecurityTimeToFetchRawResources + fetchTime : fetchTime;
      return res.map(r => r.body)
    } catch (err) {
      error('____________________________ E R R O R ____________________________________________________')
      error(err)
      error(JSON.stringify(err))
      error('___________________________________________________________________________________________')
      throw new SriError({ status: 503, errors: [{ code: 'security.request.failed', msg: 'Retrieving security information failed.' }] })
    }
  }

  function composeRawResourcesUrl(component, operation, person) {
    return '/security/query/resources/raw?component=' + component
      + '&ability=' + operation
      + '&person=' + person;
  }

  async function requestRawResourcesFromSecurityServer(component, operation, sriRequest) {
    const person = getPersonFromSriRequest(sriRequest);
    const url = composeRawResourcesUrl(component, operation, person);
    // an optimalisation might be to be able to skip ability parameter and cache resources raw for all abilities together
    // (needs change in security API)

    const [resourcesRaw] = await doSecurityRequest([{ href: url, verb: 'GET' }], sriRequest);
    return resourcesRaw;
  }


  async function checkPermissionOnElements(component, tx, sriRequest, elements, operation, immediately = false) {
    const resourceTypes = _.uniq(elements.map(e => utils.getResourceFromUrl(e.permalink)))

    if (resourceTypes.length > 1) {
      // Do not allow mixed resource output. Does normally not occur.
      error(`sri-security | ERR: Mixed resource output:`)
      error(elements)
      throw new SriError({ status: 403 })
    }

    const [resourceType] = resourceTypes
    let resourcesRaw;
    if (memResourcesRawInternal !== null) {
      resourcesRaw = await memResourcesRawInternal(sriRequest, tx, component, operation, getPersonFromSriRequest(sriRequest));
    } else {
      resourcesRaw = await requestRawResourcesFromSecurityServer(component, operation, sriRequest);
    }
    let relevantRawResources = _.filter(resourcesRaw, rawEntry => (utils.getResourceFromUrl(rawEntry) === resourceType))

    const superUserResource = resourceType;
    const superUserResourceInclDeleted = resourceType + '?$$meta.deleted=any';
    if (sriRequest.containsDeleted) {
      if (relevantRawResources.includes(superUserResourceInclDeleted)) {
        sriRequest.securityHandling = 'super_user';
        return true
      }
    } else {
      if (relevantRawResources.includes(superUserResource) || relevantRawResources.includes(superUserResourceInclDeleted)) {
        sriRequest.securityHandling = 'super_user';
        return true
      }
    }

    // Deal with permalinks in relevantRawResources. As they don't need to be checked against the database,
    // we can handle them here already: exclude the keys of the permalinks from keysToCheck and filter permalinks
    // out of relevantRawResources.
    const allowedPermalinkKeys: string[] = [];
    relevantRawResources = relevantRawResources.filter(rawUrl => {
      const permalinkKey = utils.getKeyFromPermalink(rawUrl);
      if (permalinkKey !== null) {
        allowedPermalinkKeys.push(permalinkKey);
        return false; // only keep query resources in relevantRawResources
      }
      sriRequest.securityHandling = 'permalink_in_raw_list';
      return true;
    });

    const keysToCheck = elements.map(element => utils.getKeyFromPermalink(element.permalink))
      .filter(key => allowedPermalinkKeys.indexOf(key) < 0);

    // In case no keys need to be checked for security are found, nothing needs to be done.
    if (keysToCheck.length > 0) {
      if (mergeRawResourcesFun !== null) {
        // Applications have the possibility to pass a function to merge some of the resources in the relevantRawResources
        // list in combined raw resources. This way, the length of the relevantRawResources list can be reduced, which
        // results in faster security checks.
        // This needs to be done by the application as only the application knows which resources can be combined.
        relevantRawResources = mergeRawResourcesFun(relevantRawResources);
      }

      if (relevantRawResources.length === 0) {
        sriRequest.securityHandling = 'no_relevant_raw_resources'
        // This request has keys for which permission is required but no relevant resources
        //  --> obviously we can already disallow the request without any database check.
        handleNotAllowed(sriRequest);
      } else {
        // store keys and relevantRawResources, they will be checked by the beforePhaseHook of this plugin
        sriRequest.keysToCheckBySecurityPlugin = { keys: keysToCheck, relevantRawResources, ability: operation };

        if (immediately) {
          await checkKeysAgainstDatabase([sriRequest]);
        }
      }
    } else {
      sriRequest.securityHandling = 'no_keys_to_check'
    }
  }

  async function allowedCheckBatch(tx, sriRequest, elements) {
    const batch = elements.map(({ component, resource, ability }) => {
      if (component === null) throw new SriError({ status: 403 })
      const url = '/security/query/allowed?component=' + component
        + '&person=' + getPersonFromSriRequest(sriRequest)
        + '&ability=' + ability
        + (resource !== undefined ? '&resource=' + resource : '');
      return { href: url, verb: 'GET' }
    })
    const result = await doSecurityRequest(batch, sriRequest)

    const notAllowedIndices: number[] = []
    result.forEach((e, idx) => {
      if (e !== true) { notAllowedIndices.push(idx) }
    })

    if (notAllowedIndices.length > 0) {
      // In the case where the resource does not exist in the database anymore (e.g. after physical delete)
      // or the in case of a create which is not yet synced in the security server
      // the isAllowed() check fails even for superuser.
      // ==> check wether the user has the required superuser rights
      const toCheck = _.uniqWith(notAllowedIndices.map((idx) => {
        const { component, resource, ability } = elements[idx];
        const { type } = urlToTypeAndKey(resource)
        return { component, type, ability }
      }), _.isEqual)

      const rawBatch = toCheck.map(({ component, type, ability }) => {
        const url = '/security/query/resources/raw?component=' + component
          + '&person=' + getPersonFromSriRequest(sriRequest)
          + '&ability=' + ability;
        return { href: url, verb: 'GET' }
      })

      const rawResult = await doSecurityRequest(rawBatch, sriRequest)

      if (rawResult.some((e, idx) => {
        let rawRequired = toCheck[idx].type
        if (toCheck[idx].ability === 'read') {
          // $$meta.deleted=any is only required in case of ability 'read'
          rawRequired += sriRequest.containsDeleted ? '?$$meta.deleted=any' : ''
        }
        return !(e as string[]).includes(rawRequired)
      })) {
        debug('sri-security', `not allowed`)
        handleNotAllowed(sriRequest)
      }
    }
  }

  async function allowedCheckWithRawAndIsPartOfBatch(tx, sriRequest, elements) {
    const componentAbilitiesNeeded:Array<{component:string, ability:string}> = _.uniqBy(
      elements.map(({ component, _resource, ability }) => ({ component, ability })),
      ({ component, ability }) => `${component}!=!${ability}`,
    );

    const rawBatch = componentAbilitiesNeeded
      .map(({ component, ability }) => {
        if (component === null) throw new SriError({ status: 403 })
        const url = '/security/query/resources/raw?component=' + component
          + '&person=' + getPersonFromSriRequest(sriRequest)
          + '&ability=' + ability;
        return { href: url, verb: 'GET' }
      });

    const rawMap = new Map<string, any>(
        _.zip<string, any>(
          componentAbilitiesNeeded.map<string>(({ component, ability }) => `${component}!=!${ability}`),
          await doSecurityRequest(rawBatch, sriRequest),
        ) as Array<[string, any]>,
      );

    if (!await pEvery(elements, async ({ component, resource, ability }) => {
      const rawResourcesList:string[] = rawMap.get(`${component}!=!${ability}`);
      const { type: resourceType } = urlToTypeAndKey(resource);
      const superuserRawUrl = `${resourceType}?$$meta.deleted=any`
      if (rawResourcesList.includes(superuserRawUrl)) {
        debug('sri-security', `super_user rights on ${resourceType}`)
        sriRequest.securityHandling = 'super_user';
        return true;
      }

      const relevantQueries = new Set();

      rawResourcesList.forEach((u) => {
        const { base: rawResourceType } = parseResource(u);
        if (rawResourceType === resourceType) {
          relevantQueries.add(u);
        }
      });

      const rqList = Array.from(relevantQueries);
      if (relevantQueries.size > 0) {
        try {
          if (rqList.includes(resource)) {
            // shortcut when raw resources directly contains the resource permalink
            return true;
          }
          debug('sri-security', `API CALL TO ${resourceType}/ispartof for ${resource} <-> ${rqList}`);
          const result = await apiPost(`${resourceType}/ispartof`,
            {
              a: { href: resource },
              b: { hrefs: rqList },
            });
          debug('sri-security', `API result: ${result.length}`);
          return (result.length > 0);
        } catch (err) {
          error(`sri-security | CATCHED ERROR on ${resourceType}/ispartof for ${resource} and ${rqList}`);
          if ((err instanceof SriClientError) && (err.status === 404)) {
            throw new sriRequest.SriError({
              status: 500,
              errors: [{
                code: 'isPartOf.not.implemented',
                msg: `isPartOf seems to be unimplemented on ${resourceType}`,
                err: err.body,
              }],
            });
          } else {
            error(JSON.stringify(err));
            throw new sriRequest.SriError({
              status: 500,
              errors: [{
                code: 'isPartOf.failed',
                msg: `isPartOf has failed on ${resource}`,
                status: err.status,
                err: err.body,
              }],
            });
          }
        }
      } else {
        return false;
      }
    }, { concurrency: 1 })) {
      debug('sri-security', 'not allowed')
      handleNotAllowed(sriRequest)
    }
  }

  function getBaseUrl() {
    return securityConfiguration.baseUrl;
  }

  return {
    checkPermissionOnElements,
    allowedCheckBatch,
    allowedCheckWithRawAndIsPartOfBatch,
    handleNotAllowed,
    setMemResourcesRawInternal,
    setMergeRawResourcesFun,
    beforePhaseHook,
    getBaseUrl,
    clearRawUrlCaches,
    composeRawResourcesUrl,
    requestRawResourcesFromSecurityServer
  }

};

export {
  securityHandler,
}