module.exports = function (validKeys) {
  'use strict';

  if (!validKeys) {
    validKeys = [];
  }

  return {
    prepareSQL: function () {

      return {

        sql: function () {
          return this;
        },
        param: function (key) {
          this.keys = [key];
          return this;
        },
        array: function (keys) {
          this.keys = keys;
          return this;
        }
      };

    },
    convertListResourceURLToSQL: async function () {
      return true;
    },
    executeSQL: async function (database, query) {
      let key;
      let result = {
        rows: []
      };
      const foundKeys = query.keys.filter((filteredKey) => {
        return validKeys.indexOf(filteredKey) !== -1;
      });
      for (key in foundKeys) {
        if (foundKeys.hasOwnProperty(key)) {

          result.rows.push({key: foundKeys[key]});
        }
      }

      return result;
    }
  };


};
