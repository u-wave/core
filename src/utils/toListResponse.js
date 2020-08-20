'use strict';

const {
  isPlainObject,
  cloneDeep,
  get: getPath,
  set: setPath,
} = require('lodash');

function extractIncluded(data, included) {
  const includedTypes = Object.keys(included);
  if (includedTypes.length === 0) {
    return {
      data,
      included: {},
    };
  }

  const includeds = includedTypes.reduce(
    (map, typeName) => Object.assign(map, { [typeName]: [] }),
    {},
  );

  const had = new Set();

  function include(type, item) {
    if (!had.has(type + item._id)) {
      includeds[type].push(item);
      had.add(type + item._id);
    }
  }

  const resultData = [];
  data.forEach((initialItem) => {
    let item = isPlainObject(initialItem) ? initialItem : initialItem.toJSON();
    includedTypes.forEach((type) => {
      included[type].forEach((path) => {
        const includedItem = getPath(item, path);
        if (includedItem) {
          if (item === initialItem) {
            item = cloneDeep(item);
          }
          if (Array.isArray(includedItem)) {
            setPath(item, path, includedItem.map((i) => i._id));
            includedItem.forEach((i) => include(type, i));
          } else {
            setPath(item, path, includedItem._id);
            include(type, includedItem);
          }
        }
      });
    });
    resultData.push(item);
  });

  return {
    included: includeds,
    data: resultData,
  };
}

function toListResponse(list, {
  meta = {},
  included = {},
  url = null,
} = {}) {
  let props = { data: list };
  if (included) {
    props = extractIncluded(list, included);
  }
  return {
    meta: {
      included,
      ...meta,
    },
    links: url ? { self: url } : {},
    data: null,
    included: null,
    ...props,
  };
}

module.exports = toListResponse;
