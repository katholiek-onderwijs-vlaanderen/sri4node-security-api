const util = require('util')

module.exports = function (defaultComponent, app, pluginConfig, initOauthValve) {
  'use strict';

  let security;
  return {
    init: function (sriConfig) {
      pluginConfig.oauthValve = initOauthValve(sriConfig);

      security = require('./js/security')(pluginConfig, sriConfig);
    },

    setMemResourcesRawInternal: (memResourcesRawInternal) => {
      security.setMemResourcesRawInternal(memResourcesRawInternal)
    },

    install: async function (sriConfig, db) {

      this.init(sriConfig);

      let check = async function (tx, sriRequest, elements, ability) {
        // by-pass for security to be able to bootstrap security rules on the new security server when starting from scratch
        if ( defaultComponent==='/security/components/security-api' 
              &&  sriRequest.userObject && sriRequest.userObject.username==='app.security' ) {
          return;
        }
        await security.checkPermissionOnElements(defaultComponent, tx, sriRequest, elements, ability)
        //console.log('CHECK DONE')
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
          return (sriRequest.userObject!=null && sriRequest.userObject!=undefined);
        }
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
