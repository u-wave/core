'use strict';

const {
  SourceNotFoundError,
  SourceNoImportError,
  APIError,
} = require('../errors');

/**
 * @param {import('../types').Request} req
 */
const getImportableSource = (req) => {
  const uw = req.uwave;
  const { source: sourceName } = req.params;

  const source = uw.source(sourceName);
  if (!source) {
    throw new SourceNotFoundError({ name: sourceName });
  }
  if (!source.import) {
    throw new SourceNoImportError({ name: sourceName });
  }

  return source;
};

/**
 * @param {import('../types').Request} req
 */
const mergeImportParameters = (req) => ({
  ...req.query,
  ...req.body,
  ...req.params,
});

/**
 * @type {import('../types').AuthenticatedController}
 */
async function importAction(req) {
  const source = getImportableSource(req);

  const opts = mergeImportParameters(req);

  try {
    const response = await source.import(req.user, opts);

    return response;
  } catch (err) {
    throw APIError.wrap(err);
  }
}

exports.importAction = importAction;
