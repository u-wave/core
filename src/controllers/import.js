import { SourceNotFoundError, SourceNoImportError, APIError } from '../errors/index.js';

/**
 * @param {import('../types.js').Request} req
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
 * @param {import('../types.js').Request} req
 */
const mergeImportParameters = (req) => ({
  ...req.query,
  ...req.body,
  ...req.params,
});

/**
 * @type {import('../types.js').AuthenticatedController}
 */
async function importAction(req) {
  const source = getImportableSource(req);

  const opts = mergeImportParameters(req);

  try {
    const response = await source.import(req.user, opts);

    // @ts-expect-error TS2322 this YOLO implementation is going to change after this PR:
    // https://github.com/u-wave/core/pull/436
    return response;
  } catch (err) {
    throw APIError.wrap(err);
  }
}

export { importAction };
