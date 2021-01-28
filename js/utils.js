// code copy from security server -->

const path=require('path');

// Unfortunatly we seems to have generated invalid UUIDs in the past.
// (we even have uuids with invalid version like /organisations/efeb7119-60e4-8bd7-e040-fd0a059a2c55)
// Therefore we cannot use a strict uuid checker like the npm module 'uuid-validate' but do we have to be less strict.
const isUuid = (uuid) => (uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/) != null);

const parseResource = (u) => {
  if (!u) {
    return null;
  }

  const [u1, comment] = (u.includes('#'))
    ? u.split('#/')
    : [u, null];

  if (u1.includes('?')) {
    const splittedUrl = u1.split('?');
    return {
      base: splittedUrl[0],
      id: null,
      query: splittedUrl[1],
      comment,
    };
  }
  const pp = path.parse(u1);
  if (isUuid(pp.name)) {
    return {
      base: pp.dir,
      id: pp.name,
      query: null,
      comment,
    };
  }
  return {
    base: `${(pp.dir !== '/' ? pp.dir : '')}/${pp.name}`,
    id: null,
    query: null,
    comment,
  };
};

// <-- code copy from security server


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
  parseResource
};
