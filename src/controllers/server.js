import { UnknownConfigError } from '../errors/index.js';
import toItemResponse from '../utils/toItemResponse.js';

/**
 * @type {import('../types.js').Controller}
 */
async function getServerTime(req) {
  return toItemResponse({
    time: Date.now(),
  }, { url: req.fullUrl });
}

/**
 * @type {import('../types.js').AuthenticatedController}
 */
async function getAllConfig(req) {
  const { config } = req.uwave;
  const includeSchema = 'schema' in req.query;
  const values = await config.getAllConfig();

  return toItemResponse(values, {
    url: req.fullUrl,
    meta: includeSchema ? { schema: config.getSchema() } : {},
  });
}

/**
 * @type {import('../types.js').AuthenticatedController}
 */
async function getConfig(req) {
  const { config } = req.uwave;
  const { key } = req.params;
  const includeSchema = 'schema' in req.query;

  const values = await config.get(key);
  const combinedSchema = config.getSchema();
  const schema = combinedSchema.properties[key];

  if (schema === undefined) {
    throw new UnknownConfigError({ key });
  }

  return toItemResponse(values ?? {}, {
    url: req.fullUrl,
    meta: includeSchema ? { schema } : {},
  });
}

/**
 * @type {import('../types.js').AuthenticatedController}
 */
async function updateConfig(req) {
  const { config } = req.uwave;
  const { key } = req.params;
  const values = req.body;

  const combinedSchema = config.getSchema();
  const schema = combinedSchema.properties[key];
  if (schema === undefined) {
    throw new UnknownConfigError({ key });
  }

  await config.set(key, values, { user: req.user });

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

export {
  getServerTime,
  getAllConfig,
  getConfig,
  updateConfig,
};
