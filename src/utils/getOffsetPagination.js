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
function getOffsetPagination(
  query,
  { defaultSize = 100, maxSize = 100 } = {},
) {
  if (typeof query.page === 'object') {
    return {
      // @ts-ignore
      offset: parseNumber(query.page.offset, 0),
      // @ts-ignore
      limit: Math.min(maxSize, parseNumber(query.page.limit, defaultSize)),
    };
  }
  // Old way: using a `page=` and a `limit=` query parameter.
  // @ts-ignore
  const page = parseNumber(query.page, 0);
  // @ts-ignore
  const limit = Math.min(maxSize, parseNumber(query.limit, defaultSize));
  return {
    offset: page * limit,
    limit,
  };
}

module.exports = getOffsetPagination;
