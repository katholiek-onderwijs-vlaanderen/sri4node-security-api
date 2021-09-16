// const assert = require('assert');
const { assert } = require('chai');

// const nock = require('nock');
// const sri4nodeUtilsMock = require('./sri4nodeUtilsMock');
const { describe, before, it } = require('mocha');

const { isPathAllowedBasedOnResourcesRaw, stripQueryParamsFromParsedUrl } = require('../js/utils')

const optionsOptimisationModeNone = { mode: 'NONE' };
const optionsOptimisationModeNormal = { mode: 'NORMAL' };
const optionsOptimisationModeHigh = {
  mode: 'HIGH',
  queryParamsThatNotExclusivelyLimitTheResultSet: [ 'myextendingqueryparam' ],
};
const optionsOptimisationModeAggressive = {
  mode: 'AGGRESSIVE',
  queryParamsThatNotExclusivelyLimitTheResultSet: [ 'myextendingqueryparam' ],
};

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


function assertWithEmptyRawResources(mode) {
  assert.isFalse(
    isPathAllowedBasedOnResourcesRaw('', [], mode),
  );
  assert.isFalse(
    isPathAllowedBasedOnResourcesRaw('/persons?sex=MALE', [], mode),
  );
  assert.isFalse(
    isPathAllowedBasedOnResourcesRaw(`/persons/${someGuid}`, [], mode),
  );
  assert.isFalse(
    isPathAllowedBasedOnResourcesRaw(undefined, [], mode),
  );
  assert.isFalse(
    isPathAllowedBasedOnResourcesRaw(null, [], mode),
  );
}

function assertsCurrentPathLiterallyInRawResources(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE',
      ['/persons/?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons/?sex=MALE',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons/?sex=MALE',
      ['/persons?sex=MALE'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons/?sex=MALE',
      [`/persons/${someGuid}`, '/persons?sex=MALE'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=FEMALE&$$meta.deleted=any',
      [`/persons/${someGuid}`, '/persons?sex=FEMALE&$$meta.deleted=any',],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=FEMALE&limit=500',
      [`/persons/${someGuid}`, '/persons?sex=FEMALE&limit=500',],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=FEMALE&limit=500&$$meta.deleted=any',
      [`/persons/${someGuid}`, '/persons?sex=FEMALE&limit=500&$$meta.deleted=any',],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE&age=40',
      ['/persons?age=40&sex=MALE'],
      mode,
    ), expectedReturn
  );
}

function assertsCurrentPathWithoutSpecialQueryParamsInRawResources(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE&limit=500',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE&limit=500&$$includeCount=true',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE&limit=500&$$includeCount=false',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE&offset=3',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?limit=500&$$includeCount=false&sex=MALE',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?offset=3&sex=MALE',
      [`/persons/${someGuid}`, '/persons?sex=MALE'],
      mode
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/sam/organisationalunits/externalidentifiers?limit=5000&keyOffset=2018-09-18T18%3A36%3A17.623499Z,37472e60-15f8-4c48-bf4f-1d47e41dd164',
      ['/sam/organisationalunits/externalidentifiers', '/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE&limit=500&offset=3',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
}


function assertsCurrentPathWithoutSpecialQueryParamsSubsetOfRawResources(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE&limit=500',
      ['/persons'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE&title=Mijnheer',
      ['/persons?title=Mijnheer', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/sam/organisationalunits/externalidentifiers?foo=17&type=INSTITUTIONNUMBER&modifiedSince=2020-05-03&limit=5000&keyOffset=2018-09-18T18%3A36%3A17.623499Z,37472e60-15f8-4c48-bf4f-1d47e41dd164',
      ['/sam/organisationalunits/externalidentifiers?type=INSTITUTIONNUMBER', '/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
}



function assertsCurrentPathWithoutSpecialQueryParamsNoSubsetOfRawResources(mode, expectedReturn) {
    assert.equal(
        isPathAllowedBasedOnResourcesRaw(
            '/persons?sex=MALE&limit=500&offset=3',
            ['/persons?sex=FEMALE', `/persons/${someGuid}`],
            mode
        ), expectedReturn
    );
    assert.equal(
        isPathAllowedBasedOnResourcesRaw(
            '/persons?sex=MALE&limit=500',
            ['/persons?sex=FEMALE', `/persons/${someGuid}`],
            mode,
        ), expectedReturn
    );
    assert.equal(
        isPathAllowedBasedOnResourcesRaw(
            '/persons?sex=MALE&limit=500',
            ['/persons?sex=MALE&title=Mijnheer', `/persons/${someGuid}`],
            mode,
        ), expectedReturn
    );
    assert.equal(
        isPathAllowedBasedOnResourcesRaw(
            '/persons?sex=MALE',
            ['/persons?title=Mijnheer', `/persons/${someGuid}`],
            mode,
        ), expectedReturn
    );
    assert.equal(
        isPathAllowedBasedOnResourcesRaw(
            '/sam/organisationalunits/externalidentifiers?limit=5000&keyOffset=2018-09-18T18%3A36%3A17.623499Z,37472e60-15f8-4c48-bf4f-1d47e41dd164',
            ['/sam/organisationalunits/externalidentifiers?type=INSTITUTIONNUMBER', '/persons?sex=MALE', `/persons/${someGuid}`],
            mode,
        ), expectedReturn
    );
    assert.equal(
        isPathAllowedBasedOnResourcesRaw(
            '/persons?sex=MALE&limit=500&offset=3',
            ['/persons?sex=FEMALE', `/persons/${someGuid}`],
            mode
        ), expectedReturn
    );
}

function assertsCurrentPathPotentiallyExtendsRawResources(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=FEMALE&limit=500&$$meta.deleted=any',
      ['/persons?sex=FEMALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE&$$meta.deleted=true',
      ['/persons', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  // surprising maybe, but the HIGH mode should not be so smart as to know that $$meta.deleted=false is the same as not specifying that query param
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/sam/organisationalunits/externalidentifiers?type=INSTITUTIONNUMBER&$$meta.deleted=false&limit=5000&keyOffset=2018-09-18T18%3A36%3A17.623499Z,37472e60-15f8-4c48-bf4f-1d47e41dd164',
      ['/sam/organisationalunits/externalidentifiers?type=INSTITUTIONNUMBER', '/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE&limit=500&offset=3&myextendingqueryparam=123',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode
    ), expectedReturn
  );
  // the other way around should also not be so smart to assume that an extending query param 
  // in te
  assert.equal(
    isPathAllowedBasedOnResourcesRaw(
      '/persons?sex=MALE&limit=500&offset=3',
      ['/persons?sex=MALE&myextendingqueryparam=123', `/persons/${someGuid}`],
      mode
    ), expectedReturn
  );
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
    assertWithEmptyRawResources(optionsOptimisationModeNone);
    assertsCurrentPathLiterallyInRawResources(optionsOptimisationModeNone, false);
    assertsCurrentPathWithoutSpecialQueryParamsInRawResources(optionsOptimisationModeNone, false);
    assertsCurrentPathWithoutSpecialQueryParamsSubsetOfRawResources(optionsOptimisationModeNone, false);
    assertsCurrentPathWithoutSpecialQueryParamsNoSubsetOfRawResources(optionsOptimisationModeNone, false);
    assertsCurrentPathPotentiallyExtendsRawResources(optionsOptimisationModeNone, false);
  });
});

describe('isPathAllowedBasedOnResourcesRaw(...) with optimisation mode is NORMAL', function () {
  'use strict';
  it('should always return false with empty raw resources set', function () {
    assertWithEmptyRawResources(optionsOptimisationModeNormal);
  });
  it('should return true if the currentPath is literally to be found in the raw resources list', function () {
    assertsCurrentPathLiterallyInRawResources(optionsOptimisationModeNormal, true);
  });

  it('should return true if the currentPath without special query params is found in the raw resources list', function () {
    assertsCurrentPathWithoutSpecialQueryParamsInRawResources(optionsOptimisationModeNormal, true);
  });

  it('should return false if the currentPath (without special query params) is found to be a subset of one found in the raw resources list', function () {
    assertsCurrentPathWithoutSpecialQueryParamsSubsetOfRawResources(optionsOptimisationModeNormal, false);
  });

  it('should return false if the currentPath (without special query params) is no subset of any url found in the raw resources list', function () {
    assertsCurrentPathWithoutSpecialQueryParamsNoSubsetOfRawResources(optionsOptimisationModeNormal, false);
  });

  it('should return false if currentPath (without special query params) contains a query param that expands or totally modifies the resultset (like $$meta.deleted=any or true) so that it is potentially no subset anymore of any url found in the raw resources list', function () {
    assertsCurrentPathPotentiallyExtendsRawResources(optionsOptimisationModeNormal, false);
  });
});


describe('isPathAllowedBasedOnResourcesRaw(...) with optimisation mode is HIGH', function () {
  'use strict';

  it('should always return false with empty raw resources set', function () {
    assertWithEmptyRawResources(optionsOptimisationModeNormal);
  });

  it('should return true if the currentPath is literally to be found in the raw resources list', function () {
    assertsCurrentPathLiterallyInRawResources(optionsOptimisationModeHigh, true);
  });

  it('should return true if the currentPath without special query params is found in the raw resources list', function () {
    assertsCurrentPathWithoutSpecialQueryParamsInRawResources(optionsOptimisationModeHigh, true);
  });

  it('should return true if the currentPath (without special query params) is found to be a subset of one found in the raw resources list', function () {
    assertsCurrentPathWithoutSpecialQueryParamsSubsetOfRawResources(optionsOptimisationModeHigh, true);
  });

  it('should return false if the currentPath (without special query params) is no subset of any url found in the raw resources list', function () {
    assertsCurrentPathWithoutSpecialQueryParamsNoSubsetOfRawResources(optionsOptimisationModeHigh, false);
  });

  it('should return false if currentPath (without special query params) contains a query param that expands or totally modifies the resultset (like $$meta.deleted=any or true) so that it is potentially no subset anymore of any url found in the raw resources list', function () {
    assertsCurrentPathPotentiallyExtendsRawResources(optionsOptimisationModeHigh, false);
  });

});
