const util = require('util')

module.exports = function (defaultComponent, app, pluginConfig) {
  'use strict';

  let security;
  return {
    init: function (sriConfig) {
      // As the vsko security implementation depends directly on oauth, don't 
      const oauthValve = require('vsko-authentication')(app);
      oauthValve.install(sriConfig)
      pluginConfig.oauthValve = oauthValve

      security = require('./js/security')(pluginConfig, sriConfig);
    },

    install: function (sriConfig) {

      this.init(sriConfig);

      const check = async function (tx, sriRequest, elements, ability) {
        await security.checkPermissionOnElements(defaultComponent, tx, sriRequest, elements, ability)
        //console.log('CHECK DONE')
      }

      sriConfig.resources.forEach( resource => {
        // security functions should be FIRST function in handler lists
        resource.afterRead.unshift(async (tx, sriRequest, elements) => await check(tx, sriRequest, elements, 'read'))
        resource.afterInsert.unshift(async (tx, sriRequest, elements) => await check(tx, sriRequest, elements, 'create'))
        resource.afterUpdate.unshift(async (tx, sriRequest, elements) => await check(tx, sriRequest, elements, 'update'))
        resource.beforeDelete.unshift(async (tx, sriRequest, elements) => await check(tx, sriRequest, elements, 'delete'))
      })
    },

    checkPermissionOnResourceList: function (tx, sriRequest, ability, resourceList, component) { 
      if (component === undefined) {
        component = defaultComponent
      }
      if (resourceList.length === 0) {
        console.log('Warning: checkPermissionOnResourceList with empty resourceList makes no sense!')
        security.handleNotAllowed(sriRequest)
      }
      return security.checkPermissionOnElements(component, tx, sriRequest,
                                                  resourceList.map( r => { return { permalink: r }} ), ability);
    },
    allowedCheck: function (tx, sriRequest, ability, resource, component) {
      if (component === undefined) {
        component = defaultComponent
      }
      return security.allowedCheckBatch(tx, sriRequest, [{component, resource, ability }])
    },
    allowedCheckBatch: function (tx, sriRequest, elements) { return security.allowedCheckBatch(tx, sriRequest, elements) },
    getOauthValve: () => pluginConfig.oauthValve,

    // NOT intented for public usage, only used by beveiliging_nodejs
    handleNotAllowed: function (sriRequest) { return security.handleNotAllowed(sriRequest) }
  }
}
