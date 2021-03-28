'use strict';

const {
  isPlainObject,
  cloneDeep,
  get: getPath,
  set: setPath,
} = require('lodash');

/**
 * @typedef {Record<string, string[]>} IncludedOptions
 */

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

/**
 * @typedef {object} ListResponse
 * @prop {import('type-fest').JsonObject} meta
 * @prop {import('type-fest').JsonValue[]} data
 * @prop {import('type-fest').JsonObject} [included]
 * @prop {Record<string, string>} links
 */

/**
 * @template {any} TItem
 * @param {TItem[]} list
 * @param {object} [options]
 * @param {import('type-fest').JsonObject} [options.meta]
 * @param {IncludedOptions} [options.included]
 * @param {string} [options.url]
 */
function toListResponse(list, {
  meta = {},
  included,
  url,
} = {}) {
  let props = { data: list, included: null };
  if (included) {
    props = extractIncluded(list, included);
  }
  return {
    meta: {
      included,
      ...meta,
    },
    links: url ? { self: url } : {},
    ...props,
  };
}

module.exports = toListResponse;
