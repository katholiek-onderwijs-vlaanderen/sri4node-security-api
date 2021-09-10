// const assert = require('assert');
const { assert } = require('chai');

// const nock = require('nock');
// const sri4nodeUtilsMock = require('./sri4nodeUtilsMock');
const { describe, before, it } = require('mocha');

const { isPathAllowedBasedOnResourcesRaw, stripQueryParamsFromParsedUrl } = require('../js/utils')

const optionsOptimisationModeNone = { mode: 'NONE' }
const optionsOptimisationModeNormal = { mode: 'NORMAL' }
const optionsOptimisationModeAggressive = { mode: 'AGGRESSIVE' }

const someGuid = 'c005ac30-1b04-46f9-8fb0-df622b27e793';

/**
 * 
 * @param {String} queryParamsString 
 */
function sortSearchParamString(queryParamsString) {
  const queryParamsSorted = new URLSearchParams(queryParamsString);
  queryParamsSorted.sort();
  return queryParamsSorted.toString();
}

describe('stripQueryParamsFromParsedUrl(...)', function () {
  'use strict';

  before(function () {});

  it('should throw an Error if the arguments are of the wrong typê', function () {
    assert.Throw(
      () => stripQueryParamsFromParsedUrl(''),
    );
    assert.Throw(
      () => stripQueryParamsFromParsedUrl(new URL('/persons'), new Set(['a', 'b'])),
    );
  });

  it('should remove nothing if the second argument is an empty Set or missing', function () {
    const searchParamsString = 'sex=MALE&birthDateBefore=2000-01-01';
    const searchParamsStringSorted = sortSearchParamString(searchParamsString);
    
    const url = new URL(`/persons?${searchParamsString}`, 'https://xyz.com/');
    let urlStripped = stripQueryParamsFromParsedUrl(url, new Set(['a', 'b']));
    assert.strictEqual(
      sortSearchParamString(urlStripped.searchParams.toString()),
      searchParamsStringSorted,
    );

    urlStripped = stripQueryParamsFromParsedUrl(url);
    assert.strictEqual(
      sortSearchParamString(urlStripped.searchParams.toString()),
      searchParamsStringSorted,
    );
  });

  it('should remove all query params appearing in the set', function () {
    const searchParamsString = 'sex=MALE&birthDateBefore=2000-01-01';
    const searchParamsStringSorted = sortSearchParamString(searchParamsString);

    const url = new URL(`/persons?${searchParamsString}`, 'https://xyz.com/');
    let urlStripped = stripQueryParamsFromParsedUrl(url, new Set(['sex', 'b']));
    assert.strictEqual(
      sortSearchParamString(urlStripped.searchParams.toString()),
      sortSearchParamString('birthDateBefore=2000-01-01'),
    );

    urlStripped = stripQueryParamsFromParsedUrl(url, new Set(['birthDateBefore']));
    assert.strictEqual(
      sortSearchParamString(urlStripped.searchParams.toString()),
      'sex=MALE',
    );

    urlStripped = stripQueryParamsFromParsedUrl(url, new Set(['sex', 'birthDateBefore']));
    assert.strictEqual(
      sortSearchParamString(urlStripped.searchParams.toString()),
      '',
    );
  });
});


describe('isPathAllowedBasedOnResourcesRaw(...)', function () {
  'use strict';

  before(function () {

  });

  it('should throw an exception if config object not properly formatted', function () {
    assert.Throw(
      () => isPathAllowedBasedOnResourcesRaw('', [], { mode: 'NON_EXISTING_MODE'}),
    );
  });
});

describe('isPathAllowedBasedOnResourcesRaw(...) with optimisation mode is NONE', function () {
  'use strict';
  
  it('should always return false', function () {
    assert.isFalse(
      isPathAllowedBasedOnResourcesRaw('', [], optionsOptimisationModeNone),
    );
    assert.isFalse(
      isPathAllowedBasedOnResourcesRaw('/persons', [ '/persons' ], optionsOptimisationModeNone),
    );
    assert.isFalse(
      isPathAllowedBasedOnResourcesRaw('/persons', [ '/persons?sex=MALE' ], optionsOptimisationModeNone),
    );
    assert.isFalse(
      isPathAllowedBasedOnResourcesRaw('/persons', [ '/persons?sex=MALE', '/responsibilities?position=/positions/123' ], optionsOptimisationModeNone),
    );
    assert.isFalse(
      isPathAllowedBasedOnResourcesRaw('/persons?sex=MALE', ['/persons'], optionsOptimisationModeNone),
    );
    assert.isFalse(
      isPathAllowedBasedOnResourcesRaw('/persons?sex=MALE', [`/persons/${someGuid}`], optionsOptimisationModeNone),
    );
  });
});

describe('isPathAllowedBasedOnResourcesRaw(...) with optimisation mode is NORMAL', function () {
  'use strict';

  it('should return true if the currentPath is literally to be found in the raw resources list', function () {
    assert.isTrue(
      isPathAllowedBasedOnResourcesRaw(
        '/persons?sex=MALE', 
        ['/persons?sex=MALE', `/persons/${someGuid}`],
        optionsOptimisationModeNormal,
      ),
    );
  });

  it('should return true if the currentPath without special query params is found in the raw resources list', function () {
    assert.isTrue(
      isPathAllowedBasedOnResourcesRaw(
        '/persons?sex=MALE&limit=500',
        ['/persons?sex=MALE', `/persons/${someGuid}`],
        optionsOptimisationModeNormal,
      ),
    );
    assert.isTrue(
      isPathAllowedBasedOnResourcesRaw(
        '/persons?sex=MALE&limit=500&$$includeCount=true',
        ['/persons?sex=MALE', `/persons/${someGuid}`],
        optionsOptimisationModeNormal,
      ),
    );
    assert.isTrue(
      isPathAllowedBasedOnResourcesRaw(
        '/persons?sex=MALE&limit=500&$$includeCount=false',
        ['/persons?sex=MALE', `/persons/${someGuid}`],
        optionsOptimisationModeNormal,
      ),
    );
    assert.isTrue(
      isPathAllowedBasedOnResourcesRaw(
        '/persons?sex=MALE&offset=3',
        ['/persons?sex=MALE', `/persons/${someGuid}`],
        optionsOptimisationModeNormal
      ),
    );
    assert.isTrue(
      isPathAllowedBasedOnResourcesRaw(
        '/sam/organisationalunits/externalidentifiers?limit=5000&keyOffset=2018-09-18T18%3A36%3A17.623499Z,37472e60-15f8-4c48-bf4f-1d47e41dd164',
        ['/sam/organisationalunits/externalidentifiers', '/persons?sex=MALE', `/persons/${someGuid}`],
        optionsOptimisationModeNormal,
      ),
    );
    assert.isTrue(
      isPathAllowedBasedOnResourcesRaw(
        '/persons?sex=MALE&limit=500&offset=3',
        ['/persons?sex=MALE', `/persons/${someGuid}`],
        optionsOptimisationModeNormal,
      ),
    );
  });
  it('should return false if the currentPath (without special query params) is not found in the raw resources list', function () {
    assert.isFalse(
      isPathAllowedBasedOnResourcesRaw(
        '/persons?sex=MALE&limit=500',
        ['/persons?sex=FEMALE', `/persons/${someGuid}`],
        optionsOptimisationModeNormal,
      ),
    );
    assert.isFalse(
      isPathAllowedBasedOnResourcesRaw(
        '/persons?sex=MALE',
        ['/persons?title=Mijnheer', `/persons/${someGuid}`],
        optionsOptimisationModeNormal,
      ),
    );
    assert.isFalse(
      isPathAllowedBasedOnResourcesRaw(
        '/sam/organisationalunits/externalidentifiers?limit=5000&keyOffset=2018-09-18T18%3A36%3A17.623499Z,37472e60-15f8-4c48-bf4f-1d47e41dd164',
        ['/sam/organisationalunits/externalidentifiers?type=INSTITUTIONNUMBER', '/persons?sex=MALE', `/persons/${someGuid}`],
        optionsOptimisationModeNormal,
      ),
    );
    assert.isFalse(
      isPathAllowedBasedOnResourcesRaw(
        '/persons?sex=MALE&limit=500&offset=3',
        ['/persons?sex=FEMALE', `/persons/${someGuid}`],
        optionsOptimisationModeNone
      ),
    );
  });
});
