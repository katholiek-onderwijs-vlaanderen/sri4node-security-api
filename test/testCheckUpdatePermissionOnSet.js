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

describe('Check update permission on a set of elements', function () {
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
    url += '&ability=update&person=/persons/6c0592b0-1ea6-4f38-9d08-31dc793062ba';

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);

    response = ['/persons?q=rodri'];

    url = '/security/query/resources/raw?component=/security/components/persons-api';
    url += '&ability=update&person=/persons/6c0592b0-1ea6-4f38-9d08-31dc793062ba';

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);

    response = ['/content'];

    url = '/security/query/resources/raw?component=/security/components/content-api';
    url += '&ability=update&person=/persons/6c0592b0-1ea6-4f38-9d08-31dc793062ba';

    nock(configuration.SECURITY_API_HOST)
      .get(url)
      .reply(200, response);
  });

  it('should reject the update of a set of elements with a proper error object', function () {

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

    return security.checkUpdatePermissionOnSet(elements, me, '/security/components/persons-api',
      databaseMock).fail(function () {
        assert(true);
      });
  });

  it('should allow the update of a set of elements when the reduced group matches /{type}', function () {

    var content = {
      key: '0a543170-f917-fe1d-925d-9f1bb20d3957',
      name: 'index.xhtml',
      type: 'DOCUMENT',
      created: '2012-11-22T15:42:16.717Z',
      modified: '2012-11-22T15:42:17.018Z',
      importance: 'HIGH',
      language: 'nl',
      attachments: [
        {
          name: 'index.xhtml',
          type: 'CONTENT',
          contentType: 'application/xhtml+xml',
          externalUrl: 'https://testpincette.vsko.be/Website/index.xhtml',
          href: '/content/0a543170-f917-fe1d-925d-9f1bb20d3957/index.xhtml'
        },
        {
          name: 'index.txt',
          type: 'CONTENT_AS_TEXT',
          contentType: 'text/plain',
          externalUrl: 'https://testpincette.vsko.be/Website/index.xhtml?type=text%2fplain',
          href: '/content/0a543170-f917-fe1d-925d-9f1bb20d3957/index.txt'
        }
      ]
    };

    var elements = [{
      path: '/content/0a543170-f917-fe1d-925d-9f1bb20d3957',
      body: content
    }];

    var databaseMock = {};

    security = require('../js/security')(configuration, sri4nodeUtilsMock(['0a543170-f917-fe1d-925d-9f1bb20d3957']));

    return security.checkUpdatePermissionOnSet(elements, me, '/security/components/content-api',
      databaseMock).then(function () {
        assert(true);
      });
  });

  it('should allow the update of an element that the direct check in the database works', function () {

    var person = {
      key: 'df2dccb0-d944-4402-e044-d4856467bfb8',
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
      path: '/persons/df2dccb0-d944-4402-e044-d4856467bfb8',
      body: person
    }];

    var databaseMock = {};

    security = require('../js/security')(configuration, sri4nodeUtilsMock(['df2dccb0-d944-4402-e044-d4856467bfb8']));

    return security.checkUpdatePermissionOnSet(elements, me, '/security/components/persons-api',
      databaseMock).then(function () {
        assert(true);
      });
  });

});
