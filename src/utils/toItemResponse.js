'use strict';

/**
 * @param {object?} item
 * @param {{ url?: string, meta?: object }} options
 */
function toItemResponse(item, {
  url = '',
  meta = {},
} = {}) {
  return {
    meta,
    links: url ? { self: url } : {},
    data: item,
  };
}

module.exports = toItemResponse;
