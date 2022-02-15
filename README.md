# About [![Build Status](https://travis-ci.org/rodrigouroz/sri4node-security-api.svg?branch=master)](https://travis-ci.org/rodrigouroz/sri4node-security-api)

A module that connects a sri4node backend to the sri security api (https://github.com/rodrigouroz/sri-security-api).

# Installing

Installation is simple using npm:

    $ cd [your_project]
    $ npm install --save git@github.com:katholiek-onderwijs-vlaanderen/sri4node-security-api.git#<tag/branch/commit or semver:^[tag of the form 1.2.3]>

# Usage

The basic functionality works 'plug and play' (See sri4node doc about plugins: https://github.com/katholiek-onderwijs-vlaanderen/sri4node#plugins ), you only need to pass the relevant security component to use and the express app. 

Initialisation example:
```
const securityPluginConfig = {
  initOauthValve: (sriConfig, db) => { ... },
  defaultComponent: '/security/components/persons-api',
  securityApiBase: 'https://securityapi.domain.com',
  headers: { headerName: headerValue },
  auth: {
    user: 'userAllowedToQuerySecurityApi',
    pass: '...',
  },
  accessToken: 'dinky donkey',

  securityDbCheckMethod: 'CacheRawListResults' // | 'CacheRawResults'
  optimisation: {
    mode: 'AGGRESSIVE', // 'NONE' | 'NORMAL' | 'HIGH' | 'AGGRESSIVE'
    queryParamsThatNotExclusivelyLimitTheResultSet: [ 'specialParamThatMakesTheResultSetLarger' ],
    multiValuedPropertyConfig: [
      {
        name: 'roots',      // MANDATORY
        aliasses: 'rootIn',  // OPTIONAL
        correspondingSingleValuedProperty: { // OPTIONAL
          name: 'root',
          aliases: 'wortel',
        }
        moreCommaSeparatedValuesProduceASmallerSubset: false, // MANDATORY crash with a clear error message when it's missing
      },
      ...
    ],
  }
}
const securityPlugin = require('@kathondvla/sri4node-security-api-vsko')(sri4node, securityPluginConfig);

const sri4nodeConfig = {
  ...
  plugins: [
    securityPlugin,
  ],
  ...
}
```
##  What does the plugin do?

During initialisation, this plugin will install a standard security check hook on:

- afterRead: check elements on ability 'read'
- afterInsert: check elements on ability 'create'
- afterUpdate: check elements on ability 'update'
- beforeDelete: check elements on ability 'delete'

This check will retrieve the raw urls allowed for the requsting user on the configured component with the relevant ability from the condigured security API (/security/query/resources/raw?component=...&person=...&ability=...). Then it is evaluated wether the elements associated with the request are contained in the allowed raw urls. If this is not the case, a 403 Forbidden is sent.

Besides the standard functionality, following extra functions can be called (all these functions have no return value. When something is not allowed, a SriError 403 object is thrown):

# Optimisation

The various optimisation options are based upon assumptions about whether 1 url is part of the other by comparing the url query params.
For example: in most cases /things?name=car&color=red will be smaller than a query with LESS arguments like /things?name=car.
This means, that if we find out from the security API that you have read access to /things?name=car, we may assume (without double checking each key in the response) that you are allowed to query /things?name=car&color=red
This can be a huge performance improvement, and we can also take this further and assume that /things?colorIn=red,blue is a superset of /things?color=red
That is mainly what the aggressive optimisation mode tries to do.

In (at least) the pre-2022 versions of sri4node, there is no separate parsing stage of a url, so we don't get any info at this point from sri4node about whether color=... is a filter expecting one or multiple values as input.
That is why you'll have to specify these optimisation options specifically in the pluginConfig, so this plugin can do its own url parsing based on this knownledge.
# Other methods exposed by the plugin instance
## checkPermissionOnResourceList
Be aware that this function can only be used when you do security queries about your own application as the raw urls returned by security are converted to sql by sri4node for an application specific db lookup.
- `checkPermissionOnResourceList: function (tx, sriRequest, ability, resourceList, component)` Checks wether all the permalinks in resourceList are contained in the raw resources returned by the security server (similar as the standard checks from above). Failure of one of the permalinks results in a 403 Forbidden.
    - resourceList: list of permalinks to check (should be non-empty)
    - component: optional - if not specified the defaultcomponent specified at initilisation is used

## allowedCheck
Be aware that the "allowed" query functions on the security server are not optimal and can take some time. In case you are querying with resources specified and you are querying about your own application, checkPermissionOnResourceList is a better choice.
- `allowedCheck: function (tx, sriRequest, ability, resource, component)` Check if {user, ability, resource, component} is allowed by doing an allowed request on the security server. In case where the resource does not exist in the database anymore (e.g. after physical delete) or the in case of a create which is not yet synced in the security server the isAllowed() check fails even for a superuser. Therefore in case of failure of the allowed query on the security server, another check is done to see if the request can be allowed based on superuser acces (This might change with the new security server)
    - component: optional - if not specified the defaultcomponent specified at initilisation is used
- `allowedCheckBatch: function (tx, sriRequest, elements) ` Similar check as `allowedCheck` but for multiple {component, resource, ability} at once in batch.
    - elements: list of {component, resource, ability}



