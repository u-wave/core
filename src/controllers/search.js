const props = require('p-props');
const createDebug = require('debug');
const { SourceNotFoundError } = require('../errors');
const toListResponse = require('../utils/toListResponse');

const log = createDebug('uwave:http:search');

function searchAll(req) {
  const { user } = req;
  const { query } = req.query;
  const uw = req.uwave;
  const promises = {};

  uw.sources.forEach((source) => {
    promises[source.type] = source.search(user, query)
      .catch((error) => {
        log(error.message);
        // Default to empty search on failure, for now.
        return [];
      });
  });

  return props(promises);
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
