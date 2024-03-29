# Release Notes

## 2.0.53 (28-09-2021)

* added allowedCheckWithRawAndIsPartOfBatch function, to be able to do the allowed check by requesting raw resources and calling ispartof to api's - to offload the new security server
* bugfix: use pglisten/notify for clearing cache of raw resources lookup (nescessary to make the caching mechanism also usable for apps running on multiple dyno's/processes)


## 2.0.46 (18-03-2021)
* bugfix: pass sriRequestID with SriError to indicate on which sriRequest an error was thrown in a global hook, otherwise sri4node indicates the error in a random element of the batch in the JSON result instead of the one causing the error (requires sri4node sprint-239-0 or later) 
* bugfix: deal with permalinks received as raw urls from security (was probably broken since the refactor to optimize batch security by combining checks of all batch elements)

## 2.0.43 (22-02-2021)

* some bugfixes
* added possbility to pass a configuration object instead of parameters
* added possbility to cache the result of raw resources lookup. This mechanism is disabled by default (backwards compatible) and can be configured by setting the securityDbCheckMethod set to  `CacheRawListResults` (cache the result of a combined query for a raw resources list) or `CacheRawResults` (cache the result of individual raw resources) in the configuration object passed to this plugin. This new feature can only be configured with a configuration object, so a change in how configuration is passed at inialisation of this plugin might be required. Example configuration object:
```
        {
            defaultComponent: '/security/components/persons-api',
            app,
            securityDbCheckMethod: 'CacheRawListResults', 
            ...
        } );
```
The cache is only used for read operations, and is reset after each write operation to the database.

## 2.0.40 (28-01-2021)

* refactor to use efficient sql for checking keys against the sri4node database (using left join instead of IN (... ) and union all to check all relevant raw resources at once)
* added optional `immediatly` parameter to checkPermissionOnResourceList. If value of true is passed, the security check is done immediatly instead of at the beginning of the next 'phase'.
  ```
  checkPermissionOnResourceList: function (tx, sriRequest, ability, resourceList, component, immediately=false)
  ```  
* fixed the check for matching the superuser raw resource as query bypass
* added possibility to provide a `mergeRawResourcesFun`, this is an optional function which can be provided by an sri4node application to group some raw resources of the relevant raw resources together before evaluating them in the security check. 
Providing such a function can in some cases optimize the performance of the security check query. The `mergeRawResourcesFun` function takes a list of raw resources as input and needs to return a list of raw resources. 
The `mergeRawResourcesFun` can be set by calling setMergeRawResourcesFun(fun) on this plugin after configuring sri4node (which initialises the security plugin).
An example wich provides a useless function:
  ```
  const sriConfig = {
        plugins: [
           	securityPlugin, 
        ...
  };
  await sri4node.configure(app, sriConfig);
  securityPlugin.setMergeRawResourcesFun( (rawList) => rawList.map( r => r + '#foo' ) ); 
  ```  
