'use strict';

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
