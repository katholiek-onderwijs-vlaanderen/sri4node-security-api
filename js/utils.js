var isPermalink = function (href) {
  'use strict';
  return (href.match(/^\/[a-z\/]*\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(\?.*)?$/)!==null)
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


/*

TODO: lookup usage of var/consts in regexps

/content/relations/d0083583-61a2-43f9-a95c-b4f9ed54cece
/content/relations/00083583-61a2-43f9-a95c-b4f9ed54cece

/content/relations/00083583-61a2-43f9-a95c-b4f9ed54cece?foo=bar
/content/relations
/content/relations/
/content/relations?foo=bar

/content/relations?foo=/bar/x

pattern: 
RESOURCE_TYPE[/UUID | ?].*


*/


var getResourceFromUrl = function (url) {
  'use strict';

  const groups = url.match(/^(\/[a-z\/]*[[a-z]+)((\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})|\?|$|\/$)(.*)?$/)
  if (groups != null && groups.length > 0) {
    return groups[1]
  } else {
    return null
  }
};


var getResourceTypeFromPermalink = function (permalink) {
  'use strict';
  return getPartFromPermalink(permalink, 'resource');
};

var getKeyFromPermalink = function (permalink) {
  'use strict';
  return getPartFromPermalink(permalink, 'key');
};

// splits an href into an object that has the attributes `resource` and `parts`
// `parts` is an array containing pairs of parameter=value
var splitHrefIntoResourceAndParts = function (href) {
  'use strict';
  var groups = href.match(/^(\/[a-z\/]*)(\?(.+))?$/);
  var result = {};

  if (groups) {
    result.resource = groups[1];
    if (groups[3]) {
      result.parts = groups[3].split('&');
    } else {
      result.parts = [];
    }

  }

  return result;
};

var removeIfPresent = function (set) {
  'use strict';
  return function (part) {

    return set.indexOf(part) === -1;
  };

};

var isStrictSubSet = function (set, testSet) {
  'use strict';

  // if after removing all the elements from the set we get an empty set, then testSet contains set
  return testSet && testSet.length < set.length && testSet.filter(removeIfPresent(set)).length === 0;
};

var isSubSet = function (set, testSet) {
  'use strict';

  // check if it contains the set
  var equal = (set.length === testSet.length) && set.every(function (element, index) {
    return element === testSet[index];
  });

  return equal || isStrictSubSet(set, testSet);
};

var containsSubSet = function (testGroup) {
  'use strict';

  // split a group (href) into its resource and its parts
  var resourceAndParts = splitHrefIntoResourceAndParts(testGroup);

  return function (group) {
    var groupResourceAndParts = splitHrefIntoResourceAndParts(group);

    // a group contains another if they belong to the same resource and the tested group is a subset of the group
    return groupResourceAndParts.resource === resourceAndParts.resource &&
      isStrictSubSet(resourceAndParts.parts, groupResourceAndParts.parts);
  };

};

var contains = function (testGroup) {
  'use strict';

  // split a group (href) into its resource and its parts
  var resourceAndParts = splitHrefIntoResourceAndParts(testGroup);

  return function (group) {
    var groupResourceAndParts = splitHrefIntoResourceAndParts(group);

    // a group contains another if they belong to the same resource and the tested group is a subset of the group
    return groupResourceAndParts.resource === resourceAndParts.resource &&
      isSubSet(resourceAndParts.parts, groupResourceAndParts.parts);
  };

};

var reduce = function (group, index, array) {
  'use strict';

  // permalinks are not reduced
  if (isPermalink(group)) {
    return true;
  }

  // filter if there's at least one group that contains this one
  return !array.some(containsSubSet(group));
};

/**
 * Equal in this context means (we are asuming 'domain-less'/relative urls)
 * that the paths are equal, and all the query params! 
 * 
 * @param {URL} parsedUrl1 
 * @param {URL} parsedUrl2 
 */
function parsedUrlsAreEqual(parsedUrl1, parsedUrl2) {

}

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
 * 
 * @param {*} parsedUrl1 
 * @param {*} parsedUrl2 
 */
function urlIsPartOfOtherUrl(parsedUrl1, parsedUrl2) {

}

/**
 * @typedef {'NONE' | 'NORMAL' | 'AGGRESSIVE'} OptimisationMode

 * @typedef {object} OptimisationOptions
 *  @property {OptimisationMode} mode
 *  @property {string[]} extendingQueryParams
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
  return new URL(path, 'https://xyz.com');
}

const specialSriQueryParams = new Set([
  'limit',
  'offset',
  'keyOffset',
  'expand',
  '$$includeCount',
])
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
 * This function will be used for optimizing heavily how the plugin decides
 * that a certain list url can be read.
 * We do this wy comparing the path part of the urls, with the list of raw urls
 * we got from security API.
 * 
 * There will be 3 optimization modes:
 *  * NONE: always return false
 *  * SAFE: only assume something is allowed when it appears literally in the list of rawPaths
 *          (after removal of some sepcial 'operators' like limit, offset, keyOfset, ...)
 *  * AGGRESSIVE: assumes that since almost all query parameters can only LIMIT the amount of
 *          results, that we can safely assume that if security returns a url /persons?x=...
 *          that /persons?x=...&y=... will be a SUBSET and thus be allowed.
 *          In this mode it is vital that we also provide a list of exceptions
 *          ($$meta.deleted=... is one "hardcoded" exception, but the user might add other ones).
 *          Any query param in that exception list will be assumed to expand the resultset rather
 *          that limit it.
 * example:
 * {
 *        mode: 'AGGRESSIVE', // NONE | SAFE (default) | AGGRESSIVE
 *        extendingQueryParams: [ '' ], // only used in AGGRESSIVE mode
 * },
 * 
 * @param {String} currentPath 
 * @param {Set<String>} rawPaths 
 * @param {OptimisationOptions} optimisationOptions
 * 
 * @returns {Boolean}
 */
function isPathAllowedBasedOnResourcesRaw(currentPath, rawPaths, optimisationOptions = {}) {
  if (optimisationOptions.mode === 'NONE') {
    return false;
  } else if (optimisationOptions.mode === 'NORMAL') {
    const strippedUrl = stripSpecialSriQueryParamsFromParsedUrl(relativePathToUrlObj(currentPath));
    return [...rawPaths].some(
      p => pathNameAndSearchParamsAreEqual(strippedUrl, relativePathToUrlObj(p))
    );
  } else if (optimisationOptions.mode === 'AGGRESSIVE') {
    return false;
  } else {
    throw Error('[isPathAllowedBasedOnRawUrls] optimisationOptions.mode not known');
  }
}

module.exports = {

  // removes raw groups that are subsets of other raw groups in the same set
  reduceRawGroups: function (rawGroups) {
    'use strict';

    return rawGroups.filter(reduce);

  },
  getResourceTypeFromPermalink,
  getKeyFromPermalink,
  contains,
  isPermalink,
  getResourceFromUrl,
  stripQueryParamsFromParsedUrl,
  isPathAllowedBasedOnResourcesRaw,
};
