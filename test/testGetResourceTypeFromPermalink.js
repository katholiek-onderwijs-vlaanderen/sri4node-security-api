var assert = require('assert');
var utils = require('../js/utils');

describe('Get Resource Type From Permalink', function () {
  'use strict';

  it('should get the resource type from a valid permalink', function () {
    var permalink = '/organisationalunits/relations/a31fb0e8-59c4-4ed2-aad1-c305217b6544';

    assert.equal(utils.getResourceTypeFromPermalink(permalink), '/organisationalunits/relations');

    permalink = '/persons/6c0592b0-1ea6-4f38-9d08-31dc793062ba';

    assert.equal(utils.getResourceTypeFromPermalink(permalink), '/persons');
  });

  it('should return null if the input is not a permalink', function () {
    var permalink = '/organisationalunits/relations';

    assert.strictEqual(utils.getResourceTypeFromPermalink(permalink), null);
  });

});
