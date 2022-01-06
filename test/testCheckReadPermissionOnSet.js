var assert = require('assert');
var nock = require('nock');
var sri4nodeUtilsMock = require('./sri4nodeUtilsMock');
var it = require('mocha').it;
var describe = require('mocha').describe;
var before = require('mocha').before;

var configuration = {
  USER: '<never commit passwords in a source code repo>',
  PASSWORD: '***REMOVED***',
  SECURITY_API_HOST: 'https://testapi.vsko.be'
};

var security;

describe('Check read permission on a set of elements', function () {
  'use strict';

  var me;
  before(function () {

    me = {
      uuid: '6c0592b0-1ea6-4f38-9d08-31dc793062ba'
    };

    var response;
    var url;

    response = [
      '/content?type=CURRICULUM'
    ];

    url = '/security/query/resources/raw?component=/security/components/content-api';
    url += '&ability=read&person=/persons/6c0592b0-1ea6-4f38-9d08-31dc793062ba';

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);

    response = [
      '/content?type=CURRICULUM&public=true'
    ];

    url = '/security/query/resources/raw?component=/security/components/content-api';
    url += '&ability=read&person=*';

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);

    response = [
      '/content'
    ];

    url = '/security/query/resources/raw?component=/security/components/content-api';
    url += '&ability=read&person=/persons/7c0592b0-1ea6-4f38-9d08-31dc793062ba';

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);

    response = [
      '/persons'
    ];

    url = '/security/query/resources/raw?component=/security/components/persons-api';
    url += '&ability=read&person=/persons/6c0592b0-1ea6-4f38-9d08-31dc793062ba';

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);

  });

  it('should allow the read of a set of elements if the special case returns true for a filtered case', function () {

    var elements = [{
      $$meta: {
        permalink: '/content/b95fbe1b-755c-4135-83eb-77d743e12443'
      }
    }, {
      $$meta: {
        permalink: '/content/a7c119d6-8058-4c33-b329-05772c4550eb'
      }
    }];

    var databaseMock = {};

    security = require('../js/security')(configuration, sri4nodeUtilsMock([]));

    return security.checkReadPermissionOnSet(elements, me, '/security/components/content-api', databaseMock,
      '/content?type=CURRICULUM&root=/content/017ea598-fcce-4165-a03b-759950ca48c4', 'read')
      .then(function () {
        assert(true);
      });

  });

  it('should allow the read of a set of elements for an anonymous user', function () {

    var elements = [{
      $$meta: {
        permalink: '/content/b95fbe1b-755c-4135-83eb-77d743e12443'
      }
    }, {
      $$meta: {
        permalink: '/content/a7c119d6-8058-4c33-b329-05772c4550eb'
      }
    }];

    var databaseMock = {};

    security = require('../js/security')(configuration, sri4nodeUtilsMock([]));

    return security.checkReadPermissionOnSet(elements, null, '/security/components/content-api', databaseMock,
      '/content?type=CURRICULUM&public=true&root=/content/017ea598-fcce-4165-a03b-759950ca48c4', 'read')
      .then(function () {
        assert(true);
      });

  });

  it('should allow the read of a set of elements if the special case returns true for a general case', function () {

    var elements = [{
      $$meta: {
        permalink: '/content/b95fbe1b-755c-4135-83eb-77d743e12443'
      }
    }, {
      $$meta: {
        permalink: '/content/a7c119d6-8058-4c33-b329-05772c4550eb'
      }
    }];

    var databaseMock = {};

    security = require('../js/security')(configuration, sri4nodeUtilsMock([]));

    return security.checkReadPermissionOnSet(elements, {uuid: '7c0592b0-1ea6-4f38-9d08-31dc793062ba'},
      '/security/components/content-api', databaseMock, '/content', 'read')
      .then(function () {
        assert(true);
      });

  });

  it('should allow the read of elements that the direct check in the database works', function () {
    var elements = [{
      $$meta: {
        permalink: '/persons/017ea598-fcce-4165-a03b-759950ca48c4'
      },
      key: '017ea598-fcce-4165-a03b-759950ca48c4'
    }, {
      $$meta: {
        permalink: '/persons/96a50c93-02b1-41c0-a020-6a32480237f0'
      },
      key: '96a50c93-02b1-41c0-a020-6a32480237f0'
    }];

    var databaseMock = {};

    security = require('../js/security')(configuration, sri4nodeUtilsMock(['017ea598-fcce-4165-a03b-759950ca48c4',
      '96a50c93-02b1-41c0-a020-6a32480237f0']));

    return security.checkReadPermissionOnSet(elements, me, '/security/components/persons-api', databaseMock,
      '/weird-query', 'read')
      .then(function () {
        assert(true);
      });
  });

  it('should reject the read of a set of elements if it does not have permission', function () {
    var elements = [{
      $$meta: {
        permalink: '/persons/ec59842f-837a-421b-a820-fd0d916385b6'
      }
    }, {
      $$meta: {
        permalink: '/persons/017ea598-fcce-4165-a03b-759950ca48c4'
      }
    }, {
      $$meta: {
        permalink: '/persons/508990f2-1e89-424c-8e3a-fcc292e082ca'
      }
    }];

    var databaseMock = {};

    security = require('../js/security')(configuration, sri4nodeUtilsMock(['017ea598-fcce-4165-a03b-759950ca48c4',
      '508990f2-1e89-424c-8e3a-fcc292e082ca']));

    return security.checkReadPermissionOnSet(elements, me, '/security/components/persons-api', databaseMock,
      '/weird-query', 'read')
      .fail(function (error) {
        assert.equal(403, error.statusCode);
        assert.equal('Forbidden', error.body);
      });
  });

});
