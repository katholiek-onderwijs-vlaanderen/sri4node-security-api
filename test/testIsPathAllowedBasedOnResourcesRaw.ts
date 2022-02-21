// const assert = require('assert');
import { assert } from 'chai';

// const nock = require('nock');
// const sri4nodeUtilsMock = require('./sri4nodeUtilsMock');

import { isPathAllowedBasedOnResourcesRaw, stripQueryParamsFromParsedUrl,
        searchParamsProduceSubset, addSriDefaultsToOptimisationOptions,
        TOptimisationOptions } from '../src/utils';

/**
 * 
 * @param {*} array 
 * @returns the average of the values in the array
 */
function average(array, nrOfDecimals) {
  const avg = array.reduce((a,c) => a + c, 0) / (array.length || 1);
  if (nrOfDecimals !== undefined) {
    const factor = Math.pow(10, nrOfDecimals);
    return Math.round(factor * avg) / factor;
  }
  return avg;
}

/**
 * process.hrtime() method can be used to measure execution time, but returns an array
 *
 * @param {Array<Integer>} param0
 * @returns the input traslated to milliseconds
 */
 function hrtimeToMilliseconds([seconds, nanoseconds]:[number, number]) {
  return seconds * 1000 + nanoseconds / 1000000;
}

let timesUrlSearchParams:number[] = [];
let timesAggressive:number[] = [];
function isPathAllowedBasedOnResourcesRawTimed(currentPath, rawPaths, optimisationOptions) {
  const hrStart2 = process.hrtime();
  const x = new URL(currentPath, 'https://domain.com').searchParams.toString();
  const hrElapsed2 = process.hrtime(hrStart2);
  timesUrlSearchParams.push(hrtimeToMilliseconds(hrElapsed2));

  const hrStart = process.hrtime();
  const retVal = isPathAllowedBasedOnResourcesRaw(currentPath, rawPaths, optimisationOptions);
  const hrElapsed = process.hrtime(hrStart);
  if (optimisationOptions.mode === 'AGGRESSIVE') {
    timesAggressive.push(hrtimeToMilliseconds(hrElapsed));
  }
  return retVal;
}

const optionsOptimisationModeNone = { mode: 'NONE' };
const optionsOptimisationModeNormal = { mode: 'NORMAL' };
const optionsOptimisationModeHigh:TOptimisationOptions = {
  mode: 'HIGH',
  queryParamsThatNotExclusivelyLimitTheResultSet: [ 'myextendingqueryparam' ],
};
addSriDefaultsToOptimisationOptions(optionsOptimisationModeHigh);

const optionsOptimisationModeAggressive:TOptimisationOptions = {
  mode: 'AGGRESSIVE',
  queryParamsThatNotExclusivelyLimitTheResultSet: [ 'myextendingqueryparam' ],
  multiValuedPropertyConfig: [
    {
      name: 'roots',
      aliases: [ 'rootIn' ],
      correspondingSingleValuedProperty: {
        name: 'root',
        aliases: [ 'wortel' ],
      },
      moreCommaSeparatedValuesProduceASmallerSubset: false,
    },
    {
      name: 'sexIn',
      correspondingSingleValuedProperty: {
        name: 'sex',
      },
      moreCommaSeparatedValuesProduceASmallerSubset: false,
    },
  ]
};
addSriDefaultsToOptimisationOptions(optionsOptimisationModeAggressive);

const optionsOptimisationModeAggressiveWithMoreCommaSeparatedValuesProduceASmallerSubset:TOptimisationOptions = {
    mode: 'AGGRESSIVE',
    queryParamsThatNotExclusivelyLimitTheResultSet: [ 'myextendingqueryparam' ],
    multiValuedPropertyConfig: [
      { name: 'tags',
        aliases: [ 'tagContains' ],
        moreCommaSeparatedValuesProduceASmallerSubset: true,
      },
    ]
  };
addSriDefaultsToOptimisationOptions(optionsOptimisationModeAggressiveWithMoreCommaSeparatedValuesProduceASmallerSubset);


const optionsActivityplansApi:TOptimisationOptions = {
  mode: 'AGGRESSIVE',
  queryParamsThatNotExclusivelyLimitTheResultSet: [],
  "multiValuedPropertyConfig": [{
    "name": "curricula",
    "moreCommaSeparatedValuesProduceASmallerSubset": false,
    "aliases": [],
    "correspondingSingleValuedProperty": {
      "name": "curriculum",
      "aliases": []
    }
  }, {
    "name": "context.hrefIn",
    "moreCommaSeparatedValuesProduceASmallerSubset": false,
    "aliases": [],
    "correspondingSingleValuedProperty": {
      "name": "context.href",
      "aliases": []
    }
  }, {
    "name": "keys",
    "moreCommaSeparatedValuesProduceASmallerSubset": false,
    "aliases": ["keyIn"],
    "correspondingSingleValuedProperty": {
      "name": "key",
      "aliases": []
    }
  }, {
    "name": "observers",
    "moreCommaSeparatedValuesProduceASmallerSubset": false,
    "aliases": []
  }, {
    "name": "creators",
    "moreCommaSeparatedValuesProduceASmallerSubset": false,
    "aliases": []
  }, {
    "name": "rootWithCreatorContains",
    "moreCommaSeparatedValuesProduceASmallerSubset": false,
    "aliases": []
  }, {
    "name": "rootWithContextContains",
    "moreCommaSeparatedValuesProduceASmallerSubset": false,
    "aliases": []
  }, {
    "name": "goals",
    "moreCommaSeparatedValuesProduceASmallerSubset": false,
    "aliases": []
  }, {
    "name": "activityplanContextContains",
    "moreCommaSeparatedValuesProduceASmallerSubset": false,
    "aliases": []
  }]
}

addSriDefaultsToOptimisationOptions(optionsActivityplansApi);

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
    isPathAllowedBasedOnResourcesRawTimed('', [], mode),
  );
  assert.isFalse(
    isPathAllowedBasedOnResourcesRawTimed('/persons?sex=MALE', [], mode),
  );
  assert.isFalse(
    isPathAllowedBasedOnResourcesRawTimed(`/persons/${someGuid}`, [], mode),
  );
  assert.isFalse(
    isPathAllowedBasedOnResourcesRawTimed(undefined, [], mode),
  );
  assert.isFalse(
    isPathAllowedBasedOnResourcesRawTimed(null, [], mode),
  );
}

function assertsCurrentPathLiterallyInRawResources(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE',
      ['/persons/?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons/?sex=MALE',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons/?sex=MALE',
      ['/persons?sex=MALE'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons/?sex=MALE',
      [`/persons/${someGuid}`, '/persons?sex=MALE'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=FEMALE&$$meta.deleted=any',
      [`/persons/${someGuid}`, '/persons?sex=FEMALE&$$meta.deleted=any',],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=FEMALE&limit=500',
      [`/persons/${someGuid}`, '/persons?sex=FEMALE&limit=500',],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=FEMALE&limit=500&$$meta.deleted=any',
      [`/persons/${someGuid}`, '/persons?sex=FEMALE&limit=500&$$meta.deleted=any',],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&age=40',
      ['/persons?age=40&sex=MALE'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/llinkid/activityplanning/activityplans/activities/?rootWithContextContains=%2Fsam%2Forganisationalunits%2Fc61d3a60-3656-4f13-b6f1-af8f744d0d4d&limit=5000&keyOffset=2020-10-01T14%3A48%3A08.648325Z%2C3b0a095d-b525-4f8a-ac55-24fcb3a2ddc9&$$meta.deleted=any',
      ['/llinkid/activityplanning/activityplans/activities?rootWithContextContains=/sam/organisationalunits/c61d3a60-3656-4f13-b6f1-af8f744d0d4d&$$meta.deleted=any'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons/?sexIn=MALE,FEMALE',
      ['/persons?sexIn=MALE,FEMALE'],
      mode,
    ), expectedReturn
  );

}

function assertsCurrentPathWithoutSpecialQueryParamsInRawResources(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&limit=500',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&limit=500&$$includeCount=true',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&limit=500&$$includeCount=false',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&offset=3',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?limit=500&$$includeCount=false&sex=MALE',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?offset=3&sex=MALE',
      [`/persons/${someGuid}`, '/persons?sex=MALE'],
      mode
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/sam/organisationalunits/externalidentifiers?limit=5000&keyOffset=2018-09-18T18%3A36%3A17.623499Z,37472e60-15f8-4c48-bf4f-1d47e41dd164',
      ['/sam/organisationalunits/externalidentifiers', '/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&limit=500&offset=3',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
}


function assertsCurrentPathWithoutSpecialQueryParamsSubsetOfRawResources(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&limit=500',
      ['/persons'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&title=Mijnheer',
      ['/persons?title=Mijnheer', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/sam/organisationalunits/externalidentifiers?foo=17&type=INSTITUTIONNUMBER&modifiedSince=2020-05-03&limit=5000&keyOffset=2018-09-18T18%3A36%3A17.623499Z,37472e60-15f8-4c48-bf4f-1d47e41dd164',
      ['/sam/organisationalunits/externalidentifiers?type=INSTITUTIONNUMBER', '/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
}



function assertsCurrentPathWithoutSpecialQueryParamsNoSubsetOfRawResources(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&limit=500&offset=3',
      ['/persons?sex=FEMALE', `/persons/${someGuid}`],
      mode
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&limit=500',
      ['/persons?sex=FEMALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&limit=500',
      ['/persons?sex=MALE&title=Mijnheer', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE',
      ['/persons?title=Mijnheer', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/sam/organisationalunits/externalidentifiers?limit=5000&keyOffset=2018-09-18T18%3A36%3A17.623499Z,37472e60-15f8-4c48-bf4f-1d47e41dd164',
      ['/sam/organisationalunits/externalidentifiers?type=INSTITUTIONNUMBER', '/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&limit=500&offset=3',
      ['/persons?sex=FEMALE', `/persons/${someGuid}`],
      mode
    ), expectedReturn
  );
}

function assertsCurrentPathPotentiallyExtendsRawResources(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=FEMALE&limit=500&$$meta.deleted=any',
      ['/persons?sex=FEMALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&$$meta.deleted=true',
      ['/persons', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  // surprising maybe, but the HIGH mode should not be so smart as to know that $$meta.deleted=false is the same as not specifying that query param
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/sam/organisationalunits/externalidentifiers?type=INSTITUTIONNUMBER&$$meta.deleted=false&limit=5000&keyOffset=2018-09-18T18%3A36%3A17.623499Z,37472e60-15f8-4c48-bf4f-1d47e41dd164',
      ['/sam/organisationalunits/externalidentifiers?type=INSTITUTIONNUMBER', '/persons?sex=MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&limit=500&offset=3&myextendingqueryparam=123',
      ['/persons?sex=MALE', `/persons/${someGuid}`],
      mode
    ), expectedReturn
  );
  // the other way around should also not be so smart to assume that an extending query param 
  // in te
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=MALE&limit=500&offset=3',
      ['/persons?sex=MALE&myextendingqueryparam=123', `/persons/${someGuid}`],
      mode
    ), expectedReturn
  );
}

/**
 * For AGRESSIVE MODE we want that
 * /persons?$$meta.deleted=any&sex=FEMALE is considered a part of /persons?$$meta.deleted=any
 *
 * because the key AND the value of the 'potentially extending' property $$meta.deleted
 * are exactly equal on both sides
 *
 * and also that
 *  /persons?$$meta.deleted=any&nameIn=John is considered a part of /persons?$$meta.deleted=any&&nameIn=John,Bert,Calvin

 * @typedef {import("../js/utils").QueryParam} QueryParam
 *
 * @typedef {import("../js/utils").MultiValuedPropertyConfig} MultiValuedPropertyConfig
 *
 * @typedef {import("../js/utils").OptimisationOptions} OptimisationOptions

 * @param {OptimisationOptions} mode
 * @param {boolean} expectedReturn
 */
function assertsCurrentPathPotentiallyExtendsRawResourcesButBothSidesMatch(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=FEMALE&$$meta.deleted=any',
      ['/persons?$$meta.deleted=any'],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=FEMALE&$$meta.deleted=any',
      ['/persons?$$meta.deleted=any&sex=FEMALE'],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?root=John&$$meta.deleted=any',
      ['/persons?$$meta.deleted=any&rootIn=John,Bert,Isaac'],
      mode,
    ), expectedReturn
  );

}

function assertsCurrentPathMatchesRawResourcesWithIn(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=FEMALE',
      ['/persons?sexIn=FEMALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=FEMALE',
      ['/persons?sexIn=MALE,FEMALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=FEMALE',
      ['/persons?sexIn=FEMALE,MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sexIn=FEMALE',
      ['/persons?sexIn=MALE,FEMALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sexIn=FEMALE',
      ['/persons?sexIn=FEMALE,MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sexIn=FEMALE,MALE',
      ['/persons?sexIn=MALE,FEMALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sexIn=FEMALE,INTERSEX',
      ['/persons?sexIn=FEMALE,MALE,INTERSEX', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
}

function assertsCurrentPathNotMatchesRawResourcesWithIn(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=FEMALE',
      ['/persons?sexIn=', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=FEMALE',
      ['/persons?sexIn=MALE,INTERSEX', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sex=',
      ['/persons?sexIn=FEMALE,MALE', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?sexIn=FEMALE',
      ['/persons?sexIn=', `/persons/${someGuid}`],
      mode,
    ), expectedReturn
  );
    assert.equal(
      isPathAllowedBasedOnResourcesRawTimed(
        '/persons?sexIn=FEMALE,MALE',
        ['/persons?sexIn=MALE,INTERSEX', `/persons/${someGuid}`],
        mode,
      ), expectedReturn
    );
    assert.equal(
      isPathAllowedBasedOnResourcesRawTimed(
        '/persons?sexIn=FEMALE,MALE,INTERSEX',
        ['/persons?sexIn=FEMALE,MALE', `/persons/${someGuid}`],
        mode,
      ), expectedReturn
    );
}

function assertsCurrentPathMatchesHrefsWithSingletonInRawResources(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?hrefs=/persons/123',
      ['/persons/123'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?hrefs=/persons/123,/persons/456',
      ['/persons/123', '/persons/456'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?hrefs=/persons/123,/persons/456',
      ['/persons/456', '/persons/123'],
      mode,
    ), expectedReturn
  );
}

function assertsCurrentPathNotMatchingHrefsWithSingletonInRawResources(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?hrefs=/persons/123',
      ['/persons/128'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?hrefs=/persons/123,/persons/456',
      ['/persons/128', '/persons/456'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?hrefs=/persons/123,/persons/456',
      ['/persons/456', '/persons/128'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?hrefs=/persons/123,/persons/456',
      ['/persons/456'],
      mode,
    ), expectedReturn
  );
}

function assertsCurrentPathMatchesRawResourcesHref(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?hrefs=/persons/123',
      ['/persons?hrefs=/persons/123,/persons/456'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?hrefs=/persons/123',
      ['/persons?hrefs=/persons/456,/persons/123'],
      mode,
    ), expectedReturn
  );
}


function assertsCurrentPathNotMatchingRawResourcesMultivalue(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?roots=/persons/456,/persons/123,/persons/789',
      ['/persons?roots=/persons/123,/persons/456'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?rootIn=/persons/456,/persons/123,/persons/789',
      ['/persons?roots=/persons/123,/persons/456'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?roots=/persons/456,/persons/123,/persons/789',
      ['/persons?rootIn=/persons/123,/persons/456'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?rootIn=/persons/456,/persons/123,/persons/789',
      ['/persons?rootIn=/persons/123,/persons/456'],
      mode,
    ), expectedReturn
  );
}

function assertsCurrentPathMatchesRawResourcesMultiValue(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?root=/persons/123',
      ['/persons?roots=/persons/123,/persons/456'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?root=/persons/123',
      ['/persons?roots=/persons/456,/persons/123'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?root=/persons/123',
      ['/persons?roots=/persons/123'],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?root=/persons/123',
      ['/persons?rootIn=/persons/123,/persons/456'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?root=/persons/123',
      ['/persons?rootIn=/persons/456,/persons/123'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?root=/persons/123',
      ['/persons?rootIn=/persons/123'],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?wortel=/persons/123',
      ['/persons?roots=/persons/123,/persons/456'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?wortel=/persons/123',
      ['/persons?roots=/persons/456,/persons/123'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?wortel=/persons/123',
      ['/persons?roots=/persons/123'],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?wortel=/persons/123',
      ['/persons?rootIn=/persons/123,/persons/456'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?wortel=/persons/123',
      ['/persons?rootIn=/persons/456,/persons/123'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?wortel=/persons/123',
      ['/persons?rootIn=/persons/123'],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?roots=/persons/456,/persons/123',
      ['/persons?roots=/persons/123,/persons/456'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/persons?roots=/persons/456,/persons/123',
      ['/persons?roots=/persons/123,/persons/456,/persons/789'],
      mode,
    ), expectedReturn
  );

}

function assertsCurrentPathNotMatchingRawResourcesMultiValueWithOptionMoreCommaSeparatedValuesProduceASmallerSubset(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A',
      ['/content?tags=A,B,C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=C',
      ['/content?tags=A,B,C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A,C',
      ['/content?tags=A,B,C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A,C',
      ['/content?tags=B'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A',
      ['/content?tags=B'],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A',
      ['/content?tagContains=A,B,C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=C',
      ['/content?tagContains=A,B,C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A,C',
      ['/content?tagContains=A,B,C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A,C',
      ['/content?tagContains=B'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A',
      ['/content?tagContains=B'],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A',
      ['/content?tags=A,B,C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=C',
      ['/content?tags=A,B,C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A,C',
      ['/content?tags=A,B,C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A,C',
      ['/content?tags=B'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A',
      ['/content?tags=B'],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A',
      ['/content?tagContains=A,B,C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=C',
      ['/content?tagContains=A,B,C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A,C',
      ['/content?tagContains=A,B,C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A,C',
      ['/content?tagContains=B'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A',
      ['/content?tagContains=B'],
      mode,
    ), expectedReturn
  );
}

function assertsCurrentPathMatchesRawResourcesMultiValueWithOptionMoreCommaSeparatedValuesProduceASmallerSubset(mode, expectedReturn) {
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A,B,C',
      ['/content?tags=A'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A,B,C',
      ['/content?tags=C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A,B,C',
      ['/content?tags=B,C'],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A,B,C',
      ['/content?tags=A'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A,B,C',
      ['/content?tags=C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A,B,C',
      ['/content?tags=B,C'],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A,B,C',
      ['/content?tagContains=A'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A,B,C',
      ['/content?tagContains=C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tags=A,B,C',
      ['/content?tagContains=B,C'],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A,B,C',
      ['/content?tagContains=A'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A,B,C',
      ['/content?tagContains=C'],
      mode,
    ), expectedReturn
  );
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/content?tagContains=A,B,C',
      ['/content?tagContains=B,C'],
      mode,
    ), expectedReturn
  );
}


function assertsActivityplansApi(mode, expectedReturn) {
// These cases deal with '$$meta.deleted=any' at the right side, which is currently used instead of the more logic
// but currently not implemented '$$meta.deletedIn=true,false'.
// Once sri4node is adapted to this, these testcases should be adapted or might be removed.
  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/llinkid/activityplanning/activityplans/?context.href=%2Fsam%2Forganisationalunits%2Fc61d3a60-3656-4f13-b6f1-af8f744d0d4d&limit=5000',
      ["/llinkid/activityplanning/activityplans?context.hrefIn=/sam/organisationalunits/c61d3a60-3656-4f13-b6f1-af8f744d0d4d&$$meta.deleted=any",
        "/llinkid/activityplanning/activityplans/activities?rootWithContextContains=/sam/organisationalunits/c61d3a60-3656-4f13-b6f1-af8f744d0d4d&$$meta.deleted=any"],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/llinkid/activityplanning/activityplans/activities/?rootWithContextContains=%2Fsam%2Forganisationalunits%2Fc61d3a60-3656-4f13-b6f1-af8f744d0d4d&limit=5000',
      ["/llinkid/activityplanning/activityplans?context.hrefIn=/sam/organisationalunits/c61d3a60-3656-4f13-b6f1-af8f744d0d4d&$$meta.deleted=any",
        "/llinkid/activityplanning/activityplans/activities?rootWithContextContains=/sam/organisationalunits/c61d3a60-3656-4f13-b6f1-af8f744d0d4d&$$meta.deleted=any"],
      mode,
    ), expectedReturn
  );

  assert.equal(
    isPathAllowedBasedOnResourcesRawTimed(
      '/llinkid/activityplanning/activityplans/activities/?rootWithContextContains=%2Fsam%2Forganisationalunits%2Fc61d3a60-3656-4f13-b6f1-af8f744d0d4d&limit=5000&keyOffset=2020-08-28T12%3A00%3A09.632948Z,d325ae14-5b6e-4445-b58f-cbf23067299daf8f744d0d4d&limit=5000&keyOffset=2020-08-28T12%3A00%3A09.632948Z,d325ae14-5b6e-4445-b58f-cbf23067299d',
      ["/llinkid/activityplanning/activityplans?context.hrefIn=/sam/organisationalunits/c61d3a60-3656-4f13-b6f1-af8f744d0d4d&$$meta.deleted=any",
        "/llinkid/activityplanning/activityplans/activities?rootWithContextContains=/sam/organisationalunits/c61d3a60-3656-4f13-b6f1-af8f744d0d4d&$$meta.deleted=any"],
      mode,
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


describe('searchParamsProduceSubset(urlSearchParams1, urlSearchParams2, queryParamsThatNotExclusivelyLimitTheResultSet)', function () {
  'use strict';
  
  const optionsOptimisation = {
    queryParamsThatNotExclusivelyLimitTheResultSet: [ 'nonLimitingQueryParam' ]
  }

  // before(function () {});

  it('should return true if left has all or more params than right', function () {
    assert.isTrue(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&birthDateBefore=2000-01-01'),
        new URLSearchParams('sex=MALE'),
        optionsOptimisation,
      ),
    );

    assert.isTrue(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&birthDateBefore=2000-01-01&$$meta.deleted=any'),
        new URLSearchParams('sex=MALE&$$meta.deleted=any'),
        optionsOptimisation,
      ),
    );

    assert.isTrue(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&birthDateBefore=2000-01-01&$$meta.deleted=false'),
        new URLSearchParams('sex=MALE&$$meta.deleted=false'),
        optionsOptimisation,
      ),
    );

    assert.isTrue(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&birthDateBefore=2000-01-01&$$meta.deleted=true'),
        new URLSearchParams('sex=MALE&$$meta.deleted=true'),
        optionsOptimisation,
      ),
    );

  });

  it('should return true if both sides contain exactly the same queryParamThatNotExclusivelyLimitsTheResultSet', function () {
    assert.isTrue(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&birthDateBefore=2000-01-01&nonLimitingQueryParam=hello'),
        new URLSearchParams('sex=MALE&nonLimitingQueryParam=hello'),
        optionsOptimisation,
      ),
    );

    assert.isTrue(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&birthDateBefore=2000-01-01&$$meta.deleted=any'),
        new URLSearchParams('sex=MALE&$$meta.deleted=any'),
        optionsOptimisation,
      ),
    );

    assert.isTrue(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&$$meta.deleted=any'),
        new URLSearchParams('$$meta.deleted=any'),
        optionsOptimisation,
      ),
    );
  });

  it('should return true if both sides contain exactly the same queryParamThatNotExclusivelyLimitsTheResultSet and other comma-separated params are optimized as in IN AGGRESSIVE MODE', function () {
    assert.isTrue(
      searchParamsProduceSubset(
        new URLSearchParams('roots=John&$$meta.deleted=any'),
        new URLSearchParams('$$meta.deleted=any&rootIn=John,Bert,Isaac'),
        optionsOptimisationModeAggressive,
      ),
    );
  });


  it('should return false if left has less params than right', function () {
    // const queryParamsThatNotExclusivelyLimitTheResultSet = [ 'nonLimitingQueryParam' ];

    assert.isFalse(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE'),
        new URLSearchParams('sex=MALE&birthDateBefore=2000-01-01'),
        optionsOptimisation,
      ),
    );
  });

  it('should return false if only left has a non limiting query param', function () {
    // const queryParamsThatNotExclusivelyLimitTheResultSet = [ 'nonLimitingQueryParam' ];

    assert.isFalse(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&$$meta.deleted=true'),
        new URLSearchParams('sex=MALE&birthDateBefore=2000-01-01'),
        optionsOptimisation,
      ),
    );

    assert.isFalse(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&$$meta.deleted=false'),
        new URLSearchParams('sex=MALE&birthDateBefore=2000-01-01'),
        optionsOptimisation,
      ),
    );

    assert.isFalse(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&$$meta.deleted=any'),
        new URLSearchParams('sex=MALE&birthDateBefore=2000-01-01'),
        optionsOptimisation,
      ),
    );

  });

  it('should return false if both left and right have a non limiting query param, but the value is different', function () {
    // const queryParamsThatNotExclusivelyLimitTheResultSet = [ 'nonLimitingQueryParam' ];

    assert.isFalse(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&$$meta.deleted=true'),
        new URLSearchParams('sex=MALE&$$meta.deleted=false'),
        optionsOptimisation,
      ),
    );

    assert.isFalse(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&$$meta.deleted=true'),
        new URLSearchParams('sex=MALE&$$meta.deleted=any'),
        optionsOptimisation,
      ),
    );

    assert.isFalse(
      searchParamsProduceSubset(
        new URLSearchParams('sex=MALE&birthDateBefore=2000-01-01&$$meta.deleted=false'),
        new URLSearchParams('sex=MALE&$$meta.deleted=any'),
        optionsOptimisation,
      ),
    );
  });

});


describe('isPathAllowedBasedOnResourcesRawTimed(...)', function () {
  'use strict';

  // before(function () {

  // });

  it('should throw an exception if config object not properly formatted', function () {
    assert.Throw(
      () => isPathAllowedBasedOnResourcesRawTimed('', [], { mode: 'NON_EXISTING_MODE'}),
    );
  });
});

describe('isPathAllowedBasedOnResourcesRawTimed(...) with optimisation mode is NONE', function () {
  'use strict';
  
  it('should always return false', function () {
    assertWithEmptyRawResources(optionsOptimisationModeNone);
    assertsCurrentPathLiterallyInRawResources(optionsOptimisationModeNone, false);
    assertsCurrentPathWithoutSpecialQueryParamsInRawResources(optionsOptimisationModeNone, false);
    assertsCurrentPathWithoutSpecialQueryParamsSubsetOfRawResources(optionsOptimisationModeNone, false);
    assertsCurrentPathWithoutSpecialQueryParamsNoSubsetOfRawResources(optionsOptimisationModeNone, false);
    assertsCurrentPathPotentiallyExtendsRawResources(optionsOptimisationModeNone, false);
    assertsCurrentPathMatchesRawResourcesWithIn(optionsOptimisationModeNone, false);
    assertsCurrentPathNotMatchesRawResourcesWithIn(optionsOptimisationModeNone, false);
    assertsCurrentPathMatchesHrefsWithSingletonInRawResources(optionsOptimisationModeNone, false);
    assertsCurrentPathNotMatchingHrefsWithSingletonInRawResources(optionsOptimisationModeNone, false);
    assertsCurrentPathMatchesRawResourcesHref(optionsOptimisationModeNone, false);
    assertsCurrentPathNotMatchingRawResourcesMultivalue(optionsOptimisationModeNone, false);
    assertsCurrentPathMatchesRawResourcesMultiValue(optionsOptimisationModeNone, false);
    assertsCurrentPathNotMatchingRawResourcesMultiValueWithOptionMoreCommaSeparatedValuesProduceASmallerSubset(optionsOptimisationModeNone, false);
    assertsCurrentPathMatchesRawResourcesMultiValueWithOptionMoreCommaSeparatedValuesProduceASmallerSubset(optionsOptimisationModeNone, false);
  });
});

describe('isPathAllowedBasedOnResourcesRawTimed(...) with optimisation mode is NORMAL', function () {
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

  it('should return false if currentPath (without special query params) contains a query param that matches as subset of an "In"-parameter in the raw resources list', function () {
    assertsCurrentPathMatchesRawResourcesWithIn(optionsOptimisationModeNormal, false);
  });

  it('should return false if currentPath (without special query params) contains a query param that does not match as subset of an "In"-parameter in the raw resources list', function () {
    assertsCurrentPathNotMatchesRawResourcesWithIn(optionsOptimisationModeNormal, false);
  });
});


describe('isPathAllowedBasedOnResourcesRawTimed(...) with optimisation mode is HIGH', function () {
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

  it('should return false if currentPath (without special query params) contains a query param that matches as subset of an "In"-parameter in the raw resources list', function () {
    assertsCurrentPathMatchesRawResourcesWithIn(optionsOptimisationModeHigh, false);
  });

  it('should return false if currentPath (without special query params) contains a query param that not matches as subset of an "In"-parameter in the raw resources list', function () {
    assertsCurrentPathNotMatchesRawResourcesWithIn(optionsOptimisationModeHigh, false);
  });
});

describe('isPathAllowedBasedOnResourcesRawTimed(...) with optimisation mode is AGGRESSIVE', function () {
  'use strict';

  it('should always return false with empty raw resources set', function () {
    assertWithEmptyRawResources(optionsOptimisationModeAggressive);
  });

  it('should return true if the currentPath is literally to be found in the raw resources list', function () {
    assertsCurrentPathLiterallyInRawResources(optionsOptimisationModeAggressive, true);
  });

  it('should return true if the currentPath without special query params is found in the raw resources list', function () {
    assertsCurrentPathWithoutSpecialQueryParamsInRawResources(optionsOptimisationModeAggressive, true);
  });

  it('should return true if the currentPath (without special query params) is found to be a subset of one found in the raw resources list', function () {
    assertsCurrentPathWithoutSpecialQueryParamsSubsetOfRawResources(optionsOptimisationModeAggressive, true);
  });

  it('should return false if the currentPath (without special query params) is no subset of any url found in the raw resources list', function () {
    assertsCurrentPathWithoutSpecialQueryParamsNoSubsetOfRawResources(optionsOptimisationModeAggressive, false);
  });

  it('should return false if currentPath (without special query params) contains a query param that expands or totally modifies the resultset (like $$meta.deleted=any or true) so that it is potentially no subset anymore of any url found in the raw resources list', function () {
    assertsCurrentPathPotentiallyExtendsRawResources(optionsOptimisationModeAggressive, false);
  });

  it('should return true if $$meta.deleted=... (or other a query params that expand or shift the resultset) has the exact same value on both sides', function () {
    assertsCurrentPathPotentiallyExtendsRawResourcesButBothSidesMatch(optionsOptimisationModeAggressive, true);
  });


  it('should return true if currentPath (without special query params) contains a query param that matches as subset of an "In"-parameter in the raw resources list', function () {
    assertsCurrentPathMatchesRawResourcesWithIn(optionsOptimisationModeAggressive, true);
  });

  it('should return false if currentPath (without special query params) contains a query param that not matches as subset of an "In"-parameter in the raw resources list', function () {
    assertsCurrentPathNotMatchesRawResourcesWithIn(optionsOptimisationModeAggressive, false);
  });

  it('should return true if currentPath (without special query params) hrefs parameter matches with single resource(s) in resources raw', function () {
    assertsCurrentPathMatchesHrefsWithSingletonInRawResources(optionsOptimisationModeAggressive, true);
  });

  it('should return false if currentPath (without special query params) hrefs parameter does not match with single resource(s) in resources raw', function () {
    assertsCurrentPathNotMatchingHrefsWithSingletonInRawResources(optionsOptimisationModeAggressive, false);
  });
  it('should return true if currentPath (without special query params) hrefs parameter is a subset of hrefs parameter in resources raw', function () {
    assertsCurrentPathMatchesRawResourcesHref(optionsOptimisationModeAggressive, true);
  });
  it('should return false if currentPath (without special query params) multivalue parameter is not a subset of hrefs parameter in resources raw', function () {
      assertsCurrentPathNotMatchingRawResourcesMultivalue(optionsOptimisationModeAggressive, false);
  });
  it('should return true if currentPath (without special query params) multivalue parameter is subset of multivalue parameter in resources raw', function () {
    assertsCurrentPathMatchesRawResourcesMultiValue(optionsOptimisationModeAggressive, true);
  });


  it('should return false if currentPath (without special query params) multivalue parameter is not a subset of hrefs parameter in resources raw (with OptionMoreCommaSeparatedValuesProduceASmallerSubset true)', function () {
    assertsCurrentPathNotMatchingRawResourcesMultiValueWithOptionMoreCommaSeparatedValuesProduceASmallerSubset(optionsOptimisationModeAggressiveWithMoreCommaSeparatedValuesProduceASmallerSubset, false);
  });
  it('should return true if currentPath (without special query params) multivalue parameter is a subset of hrefs parameter in resources raw (with OptionMoreCommaSeparatedValuesProduceASmallerSubset true)', function () {
    assertsCurrentPathMatchesRawResourcesMultiValueWithOptionMoreCommaSeparatedValuesProduceASmallerSubset(optionsOptimisationModeAggressiveWithMoreCommaSeparatedValuesProduceASmallerSubset, true)
  });

  it('should return true for some real world activityplans-api queries', function () {
    assertsActivityplansApi(optionsActivityplansApi, true);
  });

  describe('parsing speed', () => {
    it('should be low on average', () => {
      const averageTime = average(timesUrlSearchParams, 2);
      const averageTimeAggressive = average(timesAggressive, 2);

      console.log(`${averageTime} ms on average to parse and stringify search params`);
      console.log(`${averageTimeAggressive} ms on average to figure out whether it is allowed by optimisation or not`);
      assert.isAtMost(
        averageTimeAggressive,
        0.5,
        'Parsing is too slow on average!',
      );
    });
  });

});

// TODO: test for error messages in case of
//   * unspecified mode
//   * check on error thrown  in case of aliases is not list
//   * multiValuedPropertyConfig config provided without name
//   * multiValuedPropertyConfig config provided without moreCommaSeparatedValuesProduceASmallerSubset
