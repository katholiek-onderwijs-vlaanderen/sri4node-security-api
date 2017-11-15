var Q = require('q');
var needle = require('needle');
var retry = require('retry');
var common = require('./common');
var utils = require('./utils');
var urlModule = require('url');

exports = module.exports = function (config, sri4nodeUtils) {

  'use strict';

  var reqOptions = {
    username: config.USER,
    password: config.PASSWORD,
    open_timeout: 0, //eslint-disable-line
    json: true,
    headers: common.getHeaders(config)
  };

  function constructOperation() {
    return retry.operation({
      retries: 3,
      factor: 3,
      minTimeout: 1000,
      maxTimeout: 5 * 1000,
      randomize: true
    });
  }

  function getResourceGroups(permission, me, component) {

    var operation = constructOperation();
    var deferred = Q.defer();

    var url = config.SECURITY_API_HOST + '/security/query/resources/raw?component=' + component;
    url += '&ability=' + permission;
    url += '&person=' + me;
    console.log(url);
    function handler(op, promise) {

      return function (err, response) {

        if (err) {

          if (op.retry(err)) {
            return;
          }

          promise.reject(err);
        }

        if (response && response.statusCode === 200) {
          promise.resolve(response.body);
          // console.log('Security groups:', response.body);
        } else {
          if (response){
            console.log(response.statusCode);
          }else{
            console.log('ERROR');
          }
          promise.reject();
        }

      };
    }

    operation.attempt(function () {
      needle.get(url, reqOptions, handler(operation, deferred));
    });

    return deferred.promise;
  }

  // special case: If route is a subset of the reduction of raw security groups => allow
  function checkSpecialCaseForQuery(reducedGroups, route) {
    return reducedGroups.some(utils.contains(route));
  }

  function checkSpecialCaseForPermalink(reducedGroups, permalink) {
    var type = utils.getResourceTypeFromPermalink(permalink);
    return checkSpecialCaseForQuery(reducedGroups, type);
  }

  function checkSpecialCase(reducedGroups, route) {
    if (utils.isPermalink(route)) {
      return checkSpecialCaseForPermalink(reducedGroups, route);
    }
    return checkSpecialCaseForQuery(reducedGroups, decodeURIComponent(route));
  }

  function getKey(permission, element) {
    if (permission === 'delete') {
      return utils.getKeyFromPermalink(element.body);
    }

    return element.body.key;
  }

  function checkDirectPermissionOnSet(permission, elements, database, reducedGroups, deferred) {
    if (!deferred) {
      deferred = Q.defer();
    }
    var promises = [];
    var groupUrl;
    var i;
    var query;
    var groupDeferred;

    function checkElementsExist(promise) {

      return function (result) {
        if (result.rows.length === elements.length) {
          promise.resolve();
        } else {
          promise.reject();
        }
      };
    }

    function getTableName(permission, element, reducedGroup) {
      var path;
      if (permission === 'delete') {
        path = element.body;
        return path.split('/')[path.split('/').length - 2];
      }
      path = reducedGroup.split('?')[0];
      return path.split('/')[path.split('/').length - 1];
    }

    function resolveQuery(queryConverted, reducedGroup, groupConvertedDeferred) {
      var keys = elements.map((element) => {
        return getKey(permission, element);
      });

      var tablename = getTableName(permission, elements[0], reducedGroup);

      return function () {
        queryConverted.sql(' AND ' + tablename + '.\"key\" IN (').array(keys).sql(')');
        //  console.log('QUERY:', queryConverted.text, queryConverted.params);
        sri4nodeUtils.executeSQL(database, queryConverted)
          .then(checkElementsExist(groupConvertedDeferred))
          .catch(function () {
            groupConvertedDeferred.reject();
          });
      };

    }

    function convertListToSqlFailed(err) {
      groupDeferred.reject();
    }

    // for each group, convert to sql and check if the elements are there
    for (i = 0; i < reducedGroups.length; i++) {
      groupUrl = urlModule.parse(reducedGroups[i], true);
      // console.log('Group url..', groupUrl);
      query = sri4nodeUtils.prepareSQL('check-resource-exist');
      groupDeferred = Q.defer();
      promises.push(groupDeferred.promise);
      // there is no guarantee that the group is mapped in the database
      sri4nodeUtils.convertListResourceURLToSQL(groupUrl.pathname, groupUrl.query, false, database, query)
        .then(resolveQuery(query, reducedGroups[i], groupDeferred))
        .fail(convertListToSqlFailed);
    }

    // at least one succeeded
    Q.allSettled(promises)
      .then(function (results) {

        if (results.some(
            function (result) {
              return result.state === 'fulfilled';
            })) {
          deferred.resolve();
        } else {
          deferred.reject({
            statusCode: 403,
            body: 'Forbidden'
          });
        }
      });

    return deferred.promise;
  }

  function checkPermission(permission, elements, me, component, database, route) {

    var deferred = Q.defer();

    // 1) get raw groups
    getResourceGroups(permission, me, component)
      .then(function (groups) {
        var reducedGroups = utils.reduceRawGroups(groups);
        // 2) check if route is subset of any raw group => grant access
        if (route && checkSpecialCase(reducedGroups, route)) {
          return deferred.resolve();
        }

        checkDirectPermissionOnSet(permission, elements, database, reducedGroups, deferred);

      })
      .fail(function (e) {
        console.log('Failed get resources..', e);
        deferred.reject({
          statusCode: 503,
          body: 'Service unavailable'
        });
      });

    return deferred.promise;
  }

  return {

    checkReadPermissionOnSet: function (elements, me, component, database, route, ability) {

      elements = elements.map(function (element) {
        return {
          path: element.$$meta.permalink,
          body: element
        };
      });

      // special case: if me === null (anonymous) we ask for person * (in beveiliging * means public)
      if (!me) {
        me = '*';
      } else {
        me = '/persons/' + me.uuid;
      }

      return checkPermission(ability, elements, me, component, database, route);
    },
    checkInsertPermissionOnSet: function (elements, me, component, database) {

      me = '/persons/' + me.uuid;

      return checkPermission('create', elements, me, component, database);
    },
    checkUpdatePermissionOnSet: function (elements, me, component, database) {

      me = '/persons/' + me.uuid;

      return checkPermission('update', elements, me, component, database);
    },
    checkDeletePermissionOnSet: function (elements, me, component, database) {

      me = '/persons/' + me.uuid;

      return checkPermission('delete', elements, me, component, database);
    }
  };

};
