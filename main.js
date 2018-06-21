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

      const check = async function (tx, sriRequest, elements, operation) {
        await security.checkPermissionOnElements(defaultComponent, tx, sriRequest, elements, operation)
      }

      sriConfig.resources.forEach( resource => {
        // security functions should be FIRST function in handler lists
        resource.afterRead.unshift((tx, sriRequest, elements) => check(tx, sriRequest, elements, 'read'))
        resource.afterInsert.unshift((tx, sriRequest, elements) => check(tx, sriRequest, elements, 'create'))
        resource.afterUpdate.unshift((tx, sriRequest, elements) => check(tx, sriRequest, elements, 'update'))
        resource.beforeDelete.unshift((tx, sriRequest, elements) => check(tx, sriRequest, elements, 'delete'))
      })
    },

    customCheck: function (tx, sriRequest, ability, resource, component) { 
        if (component === undefined) {
          component = defaultComponent
        }
        return security.customCheck(tx, sriRequest, ability, resource, component)
      },
    customCheckBatch: function (tx, sriRequest, elements) { return security.customCheckBatch(tx, sriRequest, elements) },
    handleNotAllowed: function (sriRequest) { return security.handleNotAllowed(sriRequest) },

    getOauthValve: () => pluginConfig.oauthValve
  }
}
