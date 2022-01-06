var assert = require('assert');
var nock = require('nock');
var sri4nodeUtilsMock = require('./sri4nodeUtilsMock');
var describe = require('mocha').describe;
var before = require('mocha').before;
var it = require('mocha').it;

var configuration = {
  USER: '<never commit passwords in a source code repo>',
  PASSWORD: '<never commit passwords in a source code repo>',
  SECURITY_API_HOST: 'https://testapi.vsko.be'
};

var security;

describe('Check delete permission on a set of elements', function () {
  'use strict';

  var me;
  var response;

  before(function () {

    var url;

    me = {
      uuid: '6c0592b0-1ea6-4f38-9d08-31dc793062ba'
    };

    response = [
      '/boardings',
      '/organisationalunits/relations?statuses=ACTIVE,ABOLISHED,FUTURE'
    ];

    url = '/security/query/resources/raw?component=/security/components/organisationalunits-api';
    url += '&ability=delete&person=/persons/6c0592b0-1ea6-4f38-9d08-31dc793062ba';

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);

    response = ['/persons?q=rodri'];

    url = '/security/query/resources/raw?component=/security/components/persons-api';
    url += '&ability=delete&person=/persons/6c0592b0-1ea6-4f38-9d08-31dc793062ba';

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);
  });

  it('should reject the delete of a set of elements with a proper error object', function () {

    var elements = [{
      path: '/persons/cf2dccb0-d944-4402-e044-d4856467bfb8',
      body: '/persons/cf2dccb0-d944-4402-e044-d4856467bfb8'
    }];

    var databaseMock = {};

    security = require('../js/security')(configuration, sri4nodeUtilsMock([]));

    return security.checkDeletePermissionOnSet(elements, me, '/security/components/persons-api',
      databaseMock).fail(function () {
        assert(true);
      });
  });

  it('should allow the update of an element that the direct check in the database works', function () {
    var elements = [];

    elements.push({
      path: '/organisations/d000eaea-9ce7-2590-e044-d4856467bfb8',
      body: '/organisations/d000eaea-9ce7-2590-e044-d4856467bfb8'
    });

    elements.push({
      path: '/organisations/df2dccb0-d944-4402-e044-d4856467bfb8',
      body: '/organisations/df2dccb0-d944-4402-e044-d4856467bfb8'
    });

    var databaseMock = {};

    security = require('../js/security')(configuration,
      sri4nodeUtilsMock(['df2dccb0-d944-4402-e044-d4856467bfb8',
        'd000eaea-9ce7-2590-e044-d4856467bfb8']));

    return security.checkDeletePermissionOnSet(elements, me, '/security/components/organisationalunits-api',
      databaseMock).then(function () {
        assert(true);
      });
  });
});
