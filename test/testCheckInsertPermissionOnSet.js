var assert = require('assert');
var nock = require('nock');
var sri4nodeUtilsMock = require('./sri4nodeUtilsMock');
var describe = require('mocha').describe;
var before = require('mocha').before;
var it = require('mocha').it;

var configuration = {
  USER: '<never commit passwords in a source code repo>',
  PASSWORD: '***REMOVED***',
  SECURITY_API_HOST: 'https://testapi.vsko.be'
};

var security;

describe('Check insert permission on a set of elements', function () {
  'use strict';

  var me;
  var response;

  before(function () {

    var url;

    me = {
      uuid: '6c0592b0-1ea6-4f38-9d08-31dc793062ba'
    };

    response = [
      '/clbs',
      '/schoolcommunities',
      '/organisations',
      '/cvos',
      '/schoollocations',
      '/organisationalunits/relations',
      '/governinginstitutions',
      '/schools',
      '/clblocations',
      '/boardinglocations',
      '/boardings',
      '/organisationalunits/relations?statuses=ACTIVE,ABOLISHED,FUTURE'
    ];

    url = '/security/query/resources/raw?component=/security/components/organisationalunits-api';
    url += '&ability=create&person=/persons/6c0592b0-1ea6-4f38-9d08-31dc793062ba';

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);

    response = ['/persons?q=rodri'];

    url = '/security/query/resources/raw?component=/security/components/persons-api';
    url += '&ability=create&person=/persons/6c0592b0-1ea6-4f38-9d08-31dc793062ba';

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);
  });

  it('should reject the insert of a set of elements with a proper error object', function () {

    var person = {
      key: 'cf2dccb0-d944-4402-e044-d4856467bfb8',
      firstName: 'Claire',
      lastName: 'Heeren',
      username: 'clairesheeren',
      sex: 'FEMALE',
      title: 'Mevrouw',
      nationalIdentityNumber: '480602 246 65',
      dateOfBirth: '1948-06-02',
      bankAccounts: {},
      phones: {
        mobile: {
          href: '/contactdetails/017539ef-c9c7-33d8-e050-fd0a029a7faa'
        }
      },
      addresses: {
        personal: {
          href: '/contactdetails/017539ef-7f23-33d8-e050-fd0a029a7faa'
        }
      },
      emailAddresses: {
        primary: {
          href: '/contactdetails/3094d9d5-33e1-40a5-a38a-8bb1a799babc'
        }
      },
      deceased: false
    };

    var elements = [{
      path: '/persons/cf2dccb0-d944-4402-e044-d4856467bfb8',
      body: person
    }];

    var databaseMock = {};

    security = require('../js/security')(configuration, sri4nodeUtilsMock(null));

    return security.checkInsertPermissionOnSet(elements, me, '/security/components/persons-api',
      databaseMock).fail(function () {
        assert(true);
      });
  });

  it('should allow the insert of a set of elements', function () {
    var organisation = {
      key: 'c000eaea-9ce7-2590-e044-d4856467bfb8',
      details: [{
        key: 'f6612220-9c1b-43f1-9256-9178ac4cfa19',
        startDate: '2014-10-01',
        name: 'Raad van Bestuur Katholiek Onderwijs',
        shortName: 'RvB VSKO',
        statute: 'ONBEKEND'
      }, {
        key: '15788873-99d2-482e-87dd-281c6b9801b8',
        startDate: '1940-09-01',
        endDate: '2014-09-30',
        name: 'Centraal Bureau van het katholiek Onderwijs',
        shortName: 'Centraal Bureau',
        statute: 'ONBEKEND'
      }],
      seatAddresses: [],
      type: 'BELEIDSORGAAN',
      locations: [],
      telecoms: {
        phones: [],
        faxes: [],
        emails: [],
        websites: []
      }
    };

    var elements = [{
      path: '/organisations/c000eaea-9ce7-2590-e044-d4856467bfb8',
      body: organisation
    }];

    var databaseMock = {};

    security = require('../js/security')(configuration, sri4nodeUtilsMock(['c000eaea-9ce7-2590-e044-d4856467bfb8']));

    return security.checkInsertPermissionOnSet(elements, me, '/security/components/organisationalunits-api',
      databaseMock).then(function () {
        assert(true);
      });
  });


});
