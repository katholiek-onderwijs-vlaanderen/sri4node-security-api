This is an sri4node plugin (see sri4node doc about plugins: https://github.com/katholiek-onderwijs-vlaanderen/sri4node#plugins) which deals with handling "security". It means that for each sri4node request, a security server is queried to retrieve which raw resources are allowed by the user. Then the allowed resources are compared with the requested resources to determine whether the request is allowed or not. In case the request is not allowed, it is up to the configured "oauth valve" to decide which SriError will be thrown (for example a `401 redirect` SriError redirecting to a login page when a user is not logged on yet or a `403 forbidden` SriError when someone is logged on).

# Mechanism

The most straightforward way of comparing requested resources against allowed raw resources is to gather the keys of all resources requested into one list and then verify with a composed sql query - generating the keys of all raw resources - whether all gathered keys are in the resulting key set of the composed sql query. The composed sql query is created by converting each raw resource into an sql query (with the `convertListResourceURLToSQL` function from sri4node utils) and combine them.

This however turned out to be too slow in several scenario's. Therefore several optimization mechanisms are used to avoid doing an extra potentially expensive database query for each request:
- super user access: if the user has a super user url (just the resource without parameters for requests involving only non-deleted items, the resource with only parameter `?$$meta.deleted=any` in case deleted items are involved) in his raw resources set, access is directly granted without doing an sql security check.
- batch optimization: the security checking for si4node batch requests is optimized by collecting all keys of all subrequests in a batch for which security needs to be checked and do the actual check at the next sri4node 'beforePhase' hook (https://github.com/katholiek-onderwijs-vlaanderen/sri4node#beforephase). This way, ony security query needs to be executes for each different type of request. So for a batch with 1000 read requests, only one read security query will be done instead of 1000 read security queries.
- caching of the query results of raw resources queries: cache the resulting key set of the raw resources queries. This cache is only used for read operations, and is reset after each write operation to the database.
- list resources optimization: with this optimisation, the plugin tries to match the requested list resource with the raw resources (with some manipulations like stripping irrelevant parameters as `limit=` and interpretion of parameter sets like `hrefs=A,B,C` to be able to get more matches). In case the requested list resource is matched with an allowed raw resource, access is directly granted without doing an sql security check.
- compose multiple raw resources of the same 'kind' into one raw resource, and therefore generate a more efficient sql security query

# Configuration

A configuration object needs to be passed, containing at least the relevant security component to use, the express app and a function to initialise the "oauth valve". 
- `defaultComponent`: mandatory - the security component to use in queries to the security server
- `app`: mandatory - the express app used by sri4node, needed to be able to install the "oauth valve"
- `initOauthValve`: mandatory - function to initialize the "oauth valve"
- `securityDbCheckMethod`: optional - an optimalisation for read operations, the resulting key set of raw resources is cached until the next write operation on the database. There are two possibile setting for this optimization:
   - `CacheRawListResults`: cache the key set result of each combined query for a raw resources list
   - `CacheRawResults`: cache the key set result of each individual raw resources query
   
- optimisation: optional - optimisation for reading list resources, configuration is an object:
   - `mode`: mandatory - [ `NONE` | `NORMAL` | `HIGH` | `AGGRESSIVE`] 
     * `NONE`: list resources optimisation disabled
     * `NORMAL`: only assume something is allowed when it appears literally in the list of rawPaths
           (after removal of some special 'operators' like limit, offset, keyOfset, ...)
     * `HIGH`: assumes that since almost all query parameters can only LIMIT the amount of
           results, that we can safely assume that if security returns a url `/persons?x=...`
           that `/persons?x=...&y=...` will be a SUBSET and thus be allowed.
           In this mode it is vital that we also provide a list of exceptions
           called `queryParamsThatNotExclusivelyLimitTheResultSet`
           (`$$meta.deleted=...` is one "hardcoded" exception, but the user might add other ones).
           Any query param in that exception list will be assumed to potentially expand the
           resultset (or completely change it like `$$meta.deleted=true`) rather than strictly
           limiting it.
     * `AGRESSIVE`: same as high but with even more optimisations, like for example:
           `/persons?href=/persons/123` would be equal to raw urls
             - `/persons/123`
             - `/persons?hrefIn=/persons/123,/persons/456`
           In this mode we also need a multiValuedPropertyConfig which is an array of objects
           that describes names and aliases of custom filters that can have more values (for
           example: `roots=guidA,guidB,guidC`)
   - `queryParamsThatNotExclusivelyLimitTheResultSet`: optional - an array specifying eventually those special query parameters which extend the query result instead of limiting it (like `$$meta.deleted`, which is already added by default)
   - `multiValuedPropertyConfig`: optional - an array of objects:
      - `name`: mandatory - the name of the multi valued parameter
      - `moreCommaSeparatedValuesProduceASmallerSubset`: mandatory - indicates whether more values indicates produce a bigger (like `?hrefIn=A,B,C`) or a smaller  (like `?tags=A,B,C`) result set
      - `aliases`: optional - alias for this multi valued parameter
      - `correspondingSingleValuedProperty`: optional - an object specifying a single valued parameter which corresponds with the multi valued parameter (like `?href=` could be the single property variant of `?hrefs=`) :
         - `name`:  mandatory - name of the corresponding single valued property 
         - `aliases`:  optional - alias for the corresponding single valued property  

Initialisation example:
```
const sri4node = require('sri4node');

const securityConfig = {
   defaultComponent: '/security/components/persons-api',
   app,
   securityDbCheckMethod: 'CacheRawListResults', 
   optimisation: {
      mode: 'AGGRESSIVE',
      queryParamsThatNotExclusivelyLimitTheResultSet: [ 'myextendingqueryparam' ],
      multiValuedPropertyConfig: [
        {
          name: 'roots',
          aliases: [ 'rootIn' ],
          correspondingSingleValuedProperty: {
             name: 'root',
             aliases: [ 'wortel' ],
           },
          moreCommaSeparatedValuesProduceASmallerSubset: false,
        },
};

const securityPlugin = require('@kathondvla/sri4node-security-api-vsko')(securityConfig, sri4node);

const sri4nodeConfig = {
   plugins: [
      securityPlugin
   ],
   ...
}
```

# Usage

For standard CRUD sri4node requests security handlings works out-of-the box, as this plugin will install a standard security check hook during initialisation on:

- afterRead: check elements on ability 'read'
- afterInsert: check elements on ability 'create'
- beforeUpdate and afterUpdate: check elements on ability 'update'
- beforeDelete: check elements on ability 'delete'

This check will retrieve the raw urls allowed for the requsting user on the configured component with the relevant ability. Then it is evaluated wether the elements associated with the request are contained in the allowed raw urls. If this is not the case, a `403 Forbidden` is sent.

For custom sri4node request, probably custom security is needed. Therefore can following functions can be used (all these functions have no return value. When something is not allowed, it is again up to the configured "oauth valve" to determine which SriError will be thrown):

## checkPermissionOnResourceList
Be aware that this function can only be used when you do security queries about your own application as the raw urls returned by security are converted to sql by sri4node for an application specific db lookup.
- `checkPermissionOnResourceList: function (tx, sriRequest, ability, resourceList, component)` Checks wheter all the permalinks in resourceList are contained in the raw resources returned by the security server (similar as the standard checks from above). Failure of one of the permalinks results in a `403 Forbidden`.
    - `resourceList`: list of permalinks to check (should be non-empty)
    - `component`: optional - if not specified the defaultcomponent specified at initilisation is used
    - `immediatly`: optional, default false - if set to true, security checking with the database query is done immediatly instead of at the next sri4node 'beforePhase' hook as normal due to the batch optimisation.


## allowedCheck
Be aware that the "allowed" query functions on the security server are not optimal and can take some time. In case you are querying with resources specified and you are querying about your own application, `checkPermissionOnResourceList` is a better choice.
- `allowedCheck: function (tx, sriRequest, ability, resource, component)` Check if `{user, ability, resource, component}` is allowed by doing an allowed request on the security server. In case where the resource does not exist in the database anymore (e.g. after physical delete) or the in case of a create which is not yet synced in the security server the `isAllowed()` check fails even for a superuser. Therefore in case of failure of the allowed query on the security server, another check is done to see if the request can be allowed based on superuser acces (This might change with the new security server)
    - `component`: optional - if not specified the defaultcomponent specified at initilisation is used
- `allowedCheckBatch: function (tx, sriRequest, elements) ` Similar check as `allowedCheck` but for multiple `{component, resource, ability}` at once in batch.
    - `elements`: list of `{component, resource, ability}`

## allowedCheckWithRawAndIsPartOfBatch
Same functionality as the allowedCheck. Instead of doing "allowed" queries against the security server, "resources raw" are requested from the security server and the relevant resources API's are queried with isPartOf to determine whether the original query is allowed or not. With this function the load on the security server is reduces (the api's servers will receive more load).

