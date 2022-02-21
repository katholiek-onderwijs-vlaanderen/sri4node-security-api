import { assert } from 'chai';
import * as utils from '../src/utils';

// describe('Get Resource Type From Permalink', function () {
//   'use strict';

//   it('should get the resource type from a valid permalink', function () {
//     let permalink = '/organisationalunits/relations/a31fb0e8-59c4-4ed2-aad1-c305217b6544';

//     assert.equal(utils.getResourceTypeFromPermalink(permalink), '/organisationalunits/relations');

//     permalink = '/persons/6c0592b0-1ea6-4f38-9d08-31dc793062ba';

//     assert.equal(utils.getResourceTypeFromPermalink(permalink), '/persons');
//   });

//   it('should return null if the input is not a permalink', function () {
//     let permalink = '/organisationalunits/relations';

//     assert.strictEqual(utils.getResourceTypeFromPermalink(permalink), null);
//   });

// });

describe('Get Key From Permalink', function () {
  'use strict';

  it('should get the key from a valid permalink', function () {
    const permalink = '/organisationalunits/relations/a31fb0e8-59c4-4ed2-aad1-c305217b6544';

    assert.equal(utils.getKeyFromPermalink(permalink), 'a31fb0e8-59c4-4ed2-aad1-c305217b6544');

    permalink = '/persons/6c0592b0-1ea6-4f38-9d08-31dc793062ba';

    assert.equal(utils.getKeyFromPermalink(permalink), '6c0592b0-1ea6-4f38-9d08-31dc793062ba');
  });

  it('should return null if the input is not a permalink', function () {
    const permalink = '/organisationalunits/relations';

    assert.strictEqual(utils.getKeyFromPermalink(permalink), null);
  });

});
