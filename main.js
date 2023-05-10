const { SriError, utils: sri4nodeUtils } = require('sri4node');
const utils = require('./js/utils');

const { parseResource, error, debug } = sri4nodeUtils;


/**
 * @typedef {import('sri4node')} TSri4Node
 * @typedef {import('sri4node').TSriConfig} TSriConfig
 * @typedef {import('sri4node').TPluginConfig} TPluginConfig
 */

/**
 * 
 * @param {TPluginConfig} pluginConfig 
 * @param {TSri4Node} sri4node
 * @returns 
 */
module.exports = function (pluginConfig, sri4node) {
  if (pluginConfig.component === undefined) {
    throw new Error('security plugin config error: component property is missing');
  }
  if (pluginConfig.oauthPlugin === undefined) {
    throw new Error('security plugin config error: oauthPlugin property is missing');
  }

  let security;
  let pglistener;
  return {
    /**
     * 
     * @param {TSriConfig} sriConfig 
     * @param {*} db 
     */
    init: function (sriConfig, db) {
      security = require('./js/security')(pluginConfig, sri4node);
      if ( pluginConfig.securityDbCheckMethod === 'CacheRawListResults' ||
            pluginConfig.securityDbCheckMethod === 'CacheRawResults' ) {
        pglistener = require('./js/pglistener')(db, security.clearRawUrlCaches, sri4node);
      }

      if (pluginConfig.optimisation === undefined) {
        // set default to no optimisation
        pluginConfig.optimisation = { mode: 'NONE' }
      } else {
        utils.addSriDefaultsToOptimisationOptions(pluginConfig.optimisation);
      }
    },

    setMemResourcesRawInternal: (func) => {
      security.setMemResourcesRawInternal(func)
    },

    setMergeRawResourcesFun: (func) => {
        security.setMergeRawResourcesFun(func)
    },

    install: async function (sriConfig, db) {

      this.init(sriConfig, db);

      const getUrlTemplate = (url) => {
        const strippedUrl = utils.stripSpecialSriQueryParamsFromParsedUrl(new URL(url, 'https://xyz.com'));
        strippedUrl.searchParams.sort();
        return strippedUrl.pathname + '?' + [...strippedUrl.searchParams.keys()].map(key => key + '=...').join('&');
      }

      const listRequestOptimization = async function(tx, sriRequest) {
        if (!sriRequest.isBatchPart===true) {
          const pr = parseResource(sriRequest.originalUrl);
          if (pr.id === null && pr.query !== null) {
              if (pluginConfig.optimisation.mode !== 'NONE' && pluginConfig.optimisation.mode !== 'DEBUG') {
                  const resourcesRaw = await security.requestRawResourcesFromSecurityServer(pluginConfig.component, 'read', sriRequest);
                  sriRequest.listRequest = true;
                  sriRequest.listRequestAllowedByRawResourcesOptimization =
                      utils.isPathAllowedBasedOnResourcesRaw(sriRequest.originalUrl, resourcesRaw, pluginConfig.optimisation);
              }
          }
        }
      }

      const optimisationDebugEnabled = (sriRequest, ability) => {
        if ((parseResource(sriRequest.originalUrl).query !== null) && (ability==='read') && (pluginConfig.optimisation.mode === 'DEBUG')) {
          return true;
        }
      }

      const handleDebugOptimisation = async (sriRequest, ability, allowed) => {
        if (optimisationDebugEnabled(sriRequest, ability)) {
          const resourcesRaw = await security.requestRawResourcesFromSecurityServer(pluginConfig.component, 'read', sriRequest);

          const optimisationResultWithNormal = utils.isPathAllowedBasedOnResourcesRaw(sriRequest.originalUrl,
            resourcesRaw, { ...pluginConfig.optimisation, mode: 'NORMAL' });
          const optimisationResultWithHigh = utils.isPathAllowedBasedOnResourcesRaw(sriRequest.originalUrl,
            resourcesRaw, { ...pluginConfig.optimisation, mode: 'HIGH' });
          const optimisationResultWithAggressive = utils.isPathAllowedBasedOnResourcesRaw(sriRequest.originalUrl,
            resourcesRaw, { ...pluginConfig.optimisation, mode: 'AGGRESSIVE' });
          const urlTemplate = getUrlTemplate(sriRequest.originalUrl);

          const json = {
            url: sriRequest.originalUrl,
            urlTemplate: urlTemplate,
            rawResources: security.composeRawResourcesUrl(pluginConfig.component, 'read', utils.getPersonFromSriRequest(sriRequest)),
            unoptimised: allowed,
            handling: sriRequest.securityHandling,
            normal: optimisationResultWithNormal,
            high: optimisationResultWithHigh,
            aggressive: optimisationResultWithAggressive,
            normalIsFalsePositive: optimisationResultWithNormal && (allowed === false),
            highIsFalsePositive: optimisationResultWithHigh && (allowed === false),
            aggressiveIsFalsePositive: optimisationResultWithAggressive && (allowed === false),
            normalIsFalseNegative: (optimisationResultWithNormal === false) && allowed,
            highIsFalseNegative: (optimisationResultWithHigh === false) && allowed,
            aggressiveIsFalseNegative: (optimisationResultWithAggressive === false) && allowed,
          }
          debug('sri-security', JSON.stringify(json));
        }
      }

      let check = async function (tx, sriRequest, elements, ability) {
        // by-pass for security to be able to bootstrap security rules on the new security server when starting from scratch
        try {
          if ( pluginConfig.component==='/security/components/security-api'
                &&  sriRequest.userObject && sriRequest.userObject.username==='app.security' ) {
            sriRequest.securityHandling = 'bootstrap_bypass';
          } else if (ability==='read' && sriRequest.listRequestAllowedByRawResourcesOptimization===true) {
            sriRequest.securityHandling = `listResourceOptimization (mode: ${pluginConfig.optimisation.mode})`;
          } else  if (sriRequest.isBatchPart === true) {
            const pr = parseResource(sriRequest.originalUrl);
            if (ability==='read' && pr.id === null && pr.query !== null) {
              debug('sri-security', `list resource (${sriRequest.originalUrl}) requested as part of batch -- currently security optimization is not available for such batch parts. `);
            }
            await security.checkPermissionOnElements(pluginConfig.component, tx, sriRequest, elements, ability, false)
          } else {
            try {
              await security.checkPermissionOnElements(pluginConfig.component, tx, sriRequest, elements, ability, true)
              if (pluginConfig.optimisation.mode === 'DEBUG') {
                await handleDebugOptimisation(sriRequest, ability, true);
              } 
            } catch(err) {
              // catch err and rethrow to test for false positives in handleDebugOptimisation
              if (err instanceof SriError) {
                await handleDebugOptimisation(sriRequest, ability, false);
              }
              throw err;
            }
          }
          // if no error was thrown and it is not a batch part (then db evaluation will be a combined query in the before handler)
          //   ==> the request is allowed
          if ((sriRequest.isBatchPart !== true) && !optimisationDebugEnabled(sriRequest, ability)) { // if optimisationDebug is enabled, the request is already logged
            const json = {
              url: sriRequest.originalUrl,
              urlTemplate: getUrlTemplate(sriRequest.originalUrl),
              rawResources: security.composeRawResourcesUrl(pluginConfig.component, ability, utils.getPersonFromSriRequest(sriRequest)),
              timeToFetchRawResources: sriRequest.sriSecurityTimeToFetchRawResources,
              handling: sriRequest.securityHandling,
              falseNegative: (sriRequest.listRequest === true) ? sriRequest.securityHandling.startsWith('db_check') : null,
            }
            debug('sri-security', `request allowed: ${JSON.stringify(json)}`);
          }
        } catch(err) {
          // catch err and rethrow to be able to log the rejection
          if (!optimisationDebugEnabled(sriRequest, ability)) {  // if optimisationDebug is enabled, the request is already logged
            const json = {
              url: sriRequest.originalUrl,
              urlTemplate: getUrlTemplate(sriRequest.originalUrl),
              rawResources: security.composeRawResourcesUrl(pluginConfig.component, 'read', utils.getPersonFromSriRequest(sriRequest)),
              timeToFetchRawResources: sriRequest.sriSecurityTimeToFetchRawResources,
              err
            }
            debug('sri-security', `request NOT allowed: ${JSON.stringify(json)}`);
          }
          throw err;
        }
      }

      const checkForSecurityBypass = async () => {
        try {
          // enable security bypass with following SQL:
          // > CREATE TABLE security_bypass (enabled boolean);
          // > INSERT INTO security_bypass VALUES (true);
          const [ {enabled} ] = await db.any('SELECT enabled FROM security_bypass LIMIT 1;')
          return enabled;
        } catch (err) {
          return false;
        }
      }
      const securityBypass = await checkForSecurityBypass()

      if (securityBypass === true) {
        check = async function (tx, sriRequest, elements, ability) {
          // in this mode (part of the security backup plan), everything is allowed as long a user is logged in
          if (sriRequest.userObject === null || sriRequest.userObject === undefined) {
            throw new SriError({ status: 403, sriRequestID: sriRequest.id, errors: [ 'User not logged in' ] });
          }
        }
      }

      sriConfig.resources.forEach( resource => {
        // security functions should be FIRST function in handler lists
        resource.beforeRead.unshift(listRequestOptimization);
        resource.afterRead.unshift(async (tx, sriRequest, elements) => await check(tx, sriRequest, elements, 'read'))
        resource.afterInsert.unshift(async (tx, sriRequest, elements) => await check(tx, sriRequest, elements, 'create'))
        resource.beforeUpdate.unshift(async (tx, sriRequest, elements) => await check(tx, sriRequest, elements, 'update'))
        resource.afterUpdate.unshift(async (tx, sriRequest, elements) => await check(tx, sriRequest, elements, 'update'))
        resource.beforeDelete.unshift(async (tx, sriRequest, elements) => await check(tx, sriRequest, elements, 'delete'))

        if ( pluginConfig.securityDbCheckMethod === 'CacheRawListResults' ||
             pluginConfig.securityDbCheckMethod === 'CacheRawResults' ) {
            resource.afterInsert.push(pglistener.sendNotification);
            resource.afterUpdate.push(pglistener.sendNotification);
            resource.afterDelete.push(pglistener.sendNotification);
        }
      })
      sriConfig.beforePhase.unshift(security.beforePhaseHook);
    },

    checkPermissionOnResourceList: function (tx, sriRequest, ability, resourceList, component, immediately=false) { 
      if (component === undefined) {
        component = pluginConfig.component
      }
      if (resourceList.length === 0) {
        error('Warning: checkPermissionOnResourceList with empty resourceList makes no sense!')
        security.handleNotAllowed(sriRequest)
      }
      return security.checkPermissionOnElements(component, tx, sriRequest,
                                                  resourceList.map( r => { return { permalink: r }} ), ability, immediately);
    },
    allowedCheck: function (tx, sriRequest, ability, resource, component) {
      if (component === undefined) {
        component = pluginConfig.component
      }
      return security.allowedCheckBatch(tx, sriRequest, [{component, resource, ability }])
    },
    allowedCheckBatch: function (tx, sriRequest, elements) { return security.allowedCheckBatch(tx, sriRequest, elements) },
    allowedCheckWithRawAndIsPartOfBatch: function (tx, sriRequest, elements) { return security.allowedCheckWithRawAndIsPartOfBatch(tx, sriRequest, elements) },    
    getOauthValve: () => pluginConfig.oauthPlugin,
    getBaseUrl: () => security.getBaseUrl(),

    // NOT intented for public usage, only used by beveiliging_nodejs
    handleNotAllowed: function (sriRequest) { return security.handleNotAllowed(sriRequest) }
  }
}
