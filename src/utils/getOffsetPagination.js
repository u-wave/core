'use strict';

/**
 * @param {string} str
 * @param {number} defaultN
 */
const parseNumber = (str, defaultN) => {
  const n = parseInt(str, 10);
  if (Number.isFinite(n)) {
    return n;
  }
  return defaultN;
};

/**
 * @param {import('qs').ParsedQs} query
 * @param {{ defaultSize?: number, maxSize?: number }} [options]
 */
function getOffsetPagination(query, options = {}) {
  const { defaultSize = 100, maxSize = 100 } = options;

  // TODO(goto-bus-stop) we can maybe narrow the input type here because validation
  // already ran on that object. Saves a few expect-error comments.
  if (typeof query.page === 'object') {
    return {
      // @ts-expect-error TS2322
      offset: parseNumber(query.page.offset, 0),
      // @ts-expect-error TS2322
      limit: Math.min(maxSize, parseNumber(query.page.limit, defaultSize)),
    };
  }
  // Old way: using a `page=` and a `limit=` query parameter.
  // @ts-expect-error TS2322
  const page = parseNumber(query.page, 0);
  // @ts-expect-error TS2322
  const limit = Math.min(maxSize, parseNumber(query.limit, defaultSize));
  return {
    offset: page * limit,
    limit,
  };
}

module.exports = getOffsetPagination;
