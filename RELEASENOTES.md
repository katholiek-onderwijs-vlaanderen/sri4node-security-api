# Release Notes

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
