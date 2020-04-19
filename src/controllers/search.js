const createDebug = require('debug');
const { SourceNotFoundError } = require('../errors');
const toListResponse = require('../utils/toListResponse');

const debug = createDebug('uwave:http:search');

async function searchAll(req) {
  const { user } = req;
  const { query } = req.query;
  const uw = req.uwave;
  const sourceNames = uw.sources.map((source) => source.type);
  const searches = uw.sources.map((source) => (
    source.search(user, query).catch((error) => {
      debug(error);
      // Default to empty search on failure, for now.
      return [];
    })
  ));

  const searchResults = await Promise.all(searches);

  const combinedResults = {};
  sourceNames.forEach((name, index) => {
    combinedResults[name] = searchResults[index];
  });

  return combinedResults;
}

async function search(req) {
  const { user } = req;
  const { source: sourceName } = req.params;
  const { query } = req.query;
  const uw = req.uwave;

  const source = uw.source(sourceName);
  if (!source) {
    throw new SourceNotFoundError({ name: sourceName });
  }

  const results = await source.search(user, query);

  return toListResponse(results, {
    url: req.fullUrl,
  });
}

exports.search = search;
exports.searchAll = searchAll;
