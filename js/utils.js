// Some old functions, unfortunately still in use; they need to be replaced by similar calls to sri4node common
/**
 * given any url or permalink this will return the path (strip of the resource key / the paremeters)
 * @param {string} url 
 * @returns {string | null}
 */
function getResourceFromUrl(url) {
  'use strict';

  const groups = url.match(/^(\/[a-z\/]*[[a-z]+)((\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})|(\/[0-9]+)|\?|$|\/$)(.*)?$/)
  if (groups != null && groups.length > 0) {
    return groups[1]
  } else {
    return null
  }
};


var isPermalink = function (href) {
  'use strict';
  return (href.match(/^\/[a-z\/]*\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(\?.*)?$/) !== null)
};

var getPartFromPermalink = function (permalink, part) {
  'use strict';
  var groups;

  if (isPermalink(permalink)) {
    groups = permalink.match(/^(\/[a-z\/]*)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(\?.*)?$/);
    if (part === 'resource') {
      return groups[1];
    } else if (part === 'key') {
      return groups[2];
    }
  }

  return null;
};

function getKeyFromPermalink(permalink) {
  'use strict';
  return getPartFromPermalink(permalink, 'key');
};
// <- end old functions that need to be replaced by similar calls to sri4node common


/**
 * Returns a new URL with a modifed searchParams object.
 * All the keys that appear in the queryParamsToStrip set will be removed.
 * All the other keys will be kept.
 * 
 * @param {URL} parsedUrl 
 * @param {Set<String>} queryParamsToStrip
 * @returns {URL}
 */
function stripQueryParamsFromParsedUrl(parsedUrl, queryParamsToStrip = new Set()) {
  const strippedQueryParams = [...parsedUrl.searchParams.entries()]
    .filter(([key, value]) => !queryParamsToStrip.has(key));
  let retVal = new URL(parsedUrl);
  retVal.search = new URLSearchParams(strippedQueryParams).toString();
  return retVal;
}

/**
 * @typedef {'NONE' | 'NORMAL' | 'HIGH' | 'AGGRESSIVE'} OptimisationMode
 *
 * @typedef {object} QueryParam
 *  @property {String} name
 *  @property {String[]} aliases
 *
 * @typedef {object} MultiValuedPropertyConfig
 *  @property {String} name
 *  @property {String[]} aliases
 *  @property {Boolean} moreCommaSeparatedValuesProduceASmallerSubset
 *  @property {QueryParam} correspondingSingleValuedProperty
 * 
 *
 * @typedef {object} OptimisationOptions
 *  @property {OptimisationMode} mode
 *  @property {string[]} queryParamsThatNotExclusivelyLimitTheResultSet
 *  @property {MultiValuedPropertyConfig} multiValuedPropertyConfig
 */

/**
 * Turns a string into a url object (with 'some' domain)
 * that you don't care about because your string represents a
 * relative url like /persons for example (instead of https://my.domain.com/persons)
 * 
 * @param {String} path 
 * @returns {URL}
 */
function relativePathToUrlObj(path) {
  const url = new URL(path, 'https://xyz.com');
  // remove trailing slashes
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url;
}

/**
 * sri query params that do not really have a meaning according to the data model
 * but manipulate how the results are being returned
 */
const specialSriQueryParams = new Set([
  'limit',
  'offset',
  'keyOffset',
  'expand',
  '$$includeCount',
  'modifiedSince',
  'descending',
  'orderBy',
])



const addSriDefaultsToOptimisationOptions = (optimisationOptions) => {
    /**
     * Hardcoded list of query params that are known to potentially not purely
     * limit the result set when added to a url
     */
    const sriQueryParamsThatNotExclusivelyLimitTheResultSet = new Set([
        '$$meta.deleted',
    ])
    const addSriQueryParamsThatNotExclusivelyLimitTheResultSet = (optimisationOptions) => {
        optimisationOptions.queryParamsThatNotExclusivelyLimitTheResultSet = [
            ...sriQueryParamsThatNotExclusivelyLimitTheResultSet,
            ...(optimisationOptions.queryParamsThatNotExclusivelyLimitTheResultSet || []),
        ];
    }

    const sriMultiValuedPropertyConfig = [
        {
            name: 'hrefs',
            aliases: 'hrefIn',
            moreCommaSeparatedValuesProduceASmallerSubset: false,
        }
    ];
    const addSriMultiValuedPropertyConfig = (optimisationOptions) => {
        optimisationOptions.multiValuedPropertyConfig = optimisationOptions.multiValuedPropertyConfig !== undefined
            ? optimisationOptions.multiValuedPropertyConfig.concat(sriMultiValuedPropertyConfig)
            : sriMultiValuedPropertyConfig;
    }

    addSriQueryParamsThatNotExclusivelyLimitTheResultSet(optimisationOptions);
    addSriMultiValuedPropertyConfig(optimisationOptions);
}


/**
 * Will remove 'special' query params from the url
 * @param {URL} parsedUrl
 * @return {URL}
 */
function stripSpecialSriQueryParamsFromParsedUrl(parsedUrl) {
  return stripQueryParamsFromParsedUrl(parsedUrl, specialSriQueryParams);
}

/**
 * Returns the same query params string, but sorted
 * so limit=5&expand=NONE&dateOfBirth=2000-01-01
 * will return dateOfBirth=2000-01-01&expand=NONE&limit=5
 * 
 * @param {String} queryParamsString 
 * @returns {String}
 */
function sortSearchParamString(queryParamsString) {
  const queryParamsSorted = new URLSearchParams(queryParamsString);
  queryParamsSorted.sort();
  return queryParamsSorted.toString();
}

/**
 * 
 * @param {URL} strippedUrl 
 * @param {URL} relativePathToUrlObj 
 * @returns {Boolean}
 */
function pathNameAndSearchParamsAreEqual(parsedUrl1, parsedUrl2) {
  return parsedUrl1.pathname === parsedUrl2.pathname &&
    sortSearchParamString(parsedUrl1.searchParams) === sortSearchParamString(parsedUrl2.searchParams);
}

/**
 * We want to know if the first url would procude a subset of the results
 * of the second url.
 * Check if at least all query params found on the right side are also found
 * on the left side with the same value and make an exception for the
 * queryParamsThatNotExclusivelyLimitTheResultSet
 * 
 * @param {URLSearchParams} parsedUrl1 
 * @param {URLSearchParams} parsedUrl2 
 * @param {OptimisationOptions} optimisationOptions 
 */
function searchParamsProduceSubset(urlSearchParams1, urlSearchParams2, optimisationOptions) {

  // replace aliases with their regular name
  if (optimisationOptions.mode === 'AGGRESSIVE' && optimisationOptions.multiValuedPropertyConfig !== undefined) {
    const replaceAliases = (urlSearchParams) => {
        for (const [key, value] of urlSearchParams) {
            const multiValueConfig = optimisationOptions.multiValuedPropertyConfig.find(obj =>
                    (obj.aliases && obj.aliases.includes(key)) ||
                    (
                      obj.correspondingSingleValuedProperty !== undefined &&
                      (
                        obj.correspondingSingleValuedProperty.name===key ||
                        (obj.correspondingSingleValuedProperty.aliases && obj.correspondingSingleValuedProperty.aliases.includes(key))
                      )
                    )
            );
            if (multiValueConfig !== undefined) {
                urlSearchParams.set(multiValueConfig.name, value);
                urlSearchParams.delete(key);
            };
        }
    };
    replaceAliases(urlSearchParams1);
    replaceAliases(urlSearchParams2);
  }

  const leftEntries = [...urlSearchParams1.entries()];
  const rightEntries = [...urlSearchParams2.entries()];

  // left is superset of right: left should contain everything in the right query params + maybe more 
  const leftParamsHasAllTheRightParamsAndMaybeMore = rightEntries
    .every(([key, value]) => {
        if (optimisationOptions.mode === 'AGGRESSIVE') {
            const multiValueConfig = (optimisationOptions.multiValuedPropertyConfig !== undefined)
                    ? optimisationOptions.multiValuedPropertyConfig.find(obj => obj.name === key)
                    : undefined
            if (multiValueConfig !== undefined) {
                const leftValue = urlSearchParams1.get(key);
                if (leftValue && value) {
                    const leftValueList = leftValue.split(',');
                    const rightValueList = value.split(',');
                    if (multiValueConfig.moreCommaSeparatedValuesProduceASmallerSubset===false) {
                        // 'OR' logic: scenario where more multivalue arguments extend the resultset
                        // example: persons?hrefIn=/persons/123 is a subset of persons?hrefIn=/persons/123,/persons/456
                        return leftValueList.every(val => rightValueList.includes(val));
                    } else {
                        // 'AND' logic: scenario where more multivalue arguments narrow the resultset
                        // example: content?tags=A,B,C is subset of content?tags=A,B
                        return rightValueList.every(val => leftValueList.includes(val));
                    }
                }
                return false;
            } else {
                if (key==='$$meta.deleted') {
                  // $$meta.deleted is a special parameter: it can extend instead of limit when applied
                  // and it has the special value 'any' instead of using '$$meta.deletedIn=true,false'
                  // this code can be removed once sri4node and security configuration is adapted to
                  // use uniform '$$meta.deletedIn=true,false' mechanism
                  if (value === 'any') {
                    return true; // if right is 'any', the result set produced left will always be a subset
                  } else {
                    if (urlSearchParams1.has(key)) {
                      return (urlSearchParams1.get(key) === value);
                    } else {
                      return (value === false); // if '$$meta.deleted' is not specified, the default is '$$meta.deleted=false'
                    }
                  }
                } else {
                  return (urlSearchParams1.has(key) && urlSearchParams1.get(key) === value);
                }
            }
        } else {
            return (urlSearchParams1.has(key) && urlSearchParams1.get(key) === value);
        }
     });

  if (! leftParamsHasAllTheRightParamsAndMaybeMore) {
    return false;
  } else {
    // it might produce a subset, but in order to be sure, we need to know that none of the remaining
    // params are params that might extend or shift the result (instead of purely limiting it)
    //const onlyLeftEntries = leftEntries.filter(([key, value]) => !urlSearchParams2.has(key) || urlSearchParams2.get(key) !== value);
    const onlyLeftEntries = leftEntries.filter(([key, value]) => !urlSearchParams2.has(key) || urlSearchParams2.get(key) !== value);
    const someOnlyLeftEntriesCouldExtendOrShiftTheResultset = onlyLeftEntries.some(([key, value]) => optimisationOptions.queryParamsThatNotExclusivelyLimitTheResultSet.includes(key));
    return !someOnlyLeftEntriesCouldExtendOrShiftTheResultset;
  }
}

/**
 * This function is called 'search params produce subset' to indicate that
 * the results returned by the current url would be a subset of the second url.
 * For example: /persons?sex=MALE would produce a resultset that is a subset of /persons.
 * 
 * (It is somewhat confusing, because the search params list of the first url is actually
 * a superset of the search params of the second url. So in general: if the searchParams are
 * a superset, the produced result list would normally be a subset!)
 * 
 * @param {URL} strippedUrl 
 * @param {URL} relativePathToUrlObj 
 * @param {OptimisationOptions} optimisationOptions
 * @returns {Boolean}
 */
function pathNameIsEqualAndSearchParamsProduceSubset(parsedUrl1, parsedUrl2, optimisationOptions) {
  return parsedUrl1.pathname === parsedUrl2.pathname &&
    searchParamsProduceSubset(parsedUrl1.searchParams, parsedUrl2.searchParams, optimisationOptions);
}

/**
 * This function will be used for optimizing heavily how the plugin decides
 * that a certain list url can be read.
 * We do this wy comparing the path part of the urls, with the list of raw urls
 * we got from security API.
 * 
 * There will be 3 optimization modes:
 *  * NONE: always return false
 *  * NORMAL: only assume something is allowed when it appears literally in the list of rawPaths
 *          (after removal of some special 'operators' like limit, offset, keyOfset, ...)
 *  * HIGH: assumes that since almost all query parameters can only LIMIT the amount of
 *          results, that we can safely assume that if security returns a url /persons?x=...
 *          that /persons?x=...&y=... will be a SUBSET and thus be allowed.
 *          In this mode it is vital that we also provide a list of exceptions
 *          called 'queryParamsThatNotExclusivelyLimitTheResultSet'
 *          ($$meta.deleted=... is one "hardcoded" exception, but the user might add other ones).
 *          Any query param in that exception list will be assumed to potentially expand the
 *          resultset (or completely change it like $$meta.deleted=true) rather than strictly
 *          limiting it.
 *  * AGRESSIVE: same as high but with even more optimisations, like for example:
 *          /persons?href=/persons/123 would be equal to raw urls
 *            - /persons/123
 *            - /persons?hrefIn=/persons/123,/persons/456
 *          In this mode we also need a multiValuedPropertyConfig which is an array of objects
 *          that describes names and aliases of custom filters that can have more values (for
 *          example: roots=guidA,guidB,guidC)
 * 
 * example:
 * {
 *    mode: 'AGGRESSIVE', // NONE | SAFE (default) | AGGRESSIVE
 *    queryParamsThatNotExclusivelyLimitTheResultSet: [ '' ], // only used in HIGH and AGGRESSIVE mode
 *    multiValuedPropertyConfig: [
 *      { name: 'roots',      // MANDATORY
 *        aliasses: 'rootIn',  // OPTIONAL
 *        correspondingSingleValuedProperty: { // OPTIONAL
 *          name: 'root',
 *          aliases: 'wortel',
 *        }
 *        moreCommaSeparatedValuesProduceASmallerSubset: false, // MANDATORY crash with a clear error message when it's missing
 *      }
 *    ]
 * },
 * 
 * @param {String} currentPath 
 * @param {String[]} rawPaths 
 * @param {OptimisationOptions} optimisationOptions
 * 
 * @returns {Boolean}
 */
function isPathAllowedBasedOnResourcesRaw(currentPath, rawPaths, optimisationOptions = {}) {
  if (optimisationOptions.mode === 'NONE') {
    return false;
  } else if (optimisationOptions.mode === 'NORMAL') {
    const url = relativePathToUrlObj(currentPath);
    const strippedUrl = stripSpecialSriQueryParamsFromParsedUrl(url);
    return [...rawPaths].some(
      p => pathNameAndSearchParamsAreEqual(strippedUrl, relativePathToUrlObj(p))
             || pathNameAndSearchParamsAreEqual(url, relativePathToUrlObj(p)) // allow exact match incuding SpecialSriQueryParams
    );
  } else if (optimisationOptions.mode === 'HIGH') {
    const url = relativePathToUrlObj(currentPath);
    return [...rawPaths].some(
      p => pathNameIsEqualAndSearchParamsProduceSubset(url, relativePathToUrlObj(p), optimisationOptions)
    );
  } else if (optimisationOptions.mode === 'AGGRESSIVE') {
    const url = relativePathToUrlObj(currentPath);
    const strippedUrl = stripSpecialSriQueryParamsFromParsedUrl(url);

    if (Array.from(url.searchParams).length===1 && url.searchParams.get('hrefs')!==null) {
        // This is a special case where sri4node just returns the set of permalinks of the hrefs parameter value
        // --> check if these permalinks are literally in the raw resources.
        const hrefs = url.searchParams.get('hrefs').split(',');
        if (hrefs.every(h => rawPaths.includes(h))) {
            return true;
        }
    }

    return [...rawPaths].some(
      p => pathNameIsEqualAndSearchParamsProduceSubset(strippedUrl, relativePathToUrlObj(p), optimisationOptions)
            || pathNameAndSearchParamsAreEqual(url, relativePathToUrlObj(p))  // allow exact match incuding SpecialSriQueryParams
    );
  } else {
    throw Error('[isPathAllowedBasedOnRawUrls] optimisationOptions.mode not known');
  }
}

const getPersonFromSriRequest = (sriRequest) => {
  // A userObject of null happens when the user is (not yet) logged in
  return (sriRequest.userObject ? '/persons/' + sriRequest.userObject.uuid : 'NONE');
};

module.exports = {
  getPersonFromSriRequest,
  getResourceFromUrl,
  getKeyFromPermalink,
  stripQueryParamsFromParsedUrl,
  searchParamsProduceSubset,
  isPathAllowedBasedOnResourcesRaw,
  addSriDefaultsToOptimisationOptions,
  sortSearchParamString,
  stripSpecialSriQueryParamsFromParsedUrl
};
