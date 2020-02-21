const parseNumber = (str, defaultN) => {
  const n = parseInt(str, 10);
  if (Number.isFinite(n)) {
    return n;
  }
  return defaultN;
};

function getOffsetPagination(
  query,
  { defaultSize = 100, maxSize = 100 } = {},
) {
  if (typeof query.page === 'object') {
    return {
      offset: parseNumber(query.page.offset, 0),
      limit: Math.min(maxSize, parseNumber(query.page.limit, defaultSize)),
    };
  }
  // Old way: using a `page=` and a `limit=` query parameter.
  const page = parseNumber(query.page, 0);
  const limit = Math.min(maxSize, parseNumber(query.limit, defaultSize));
  return {
    offset: page * limit,
    limit,
  };
}

module.exports = getOffsetPagination;
