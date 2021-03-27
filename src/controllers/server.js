'use strict';

const toItemResponse = require('../utils/toItemResponse');

/**
 * @type {import('../types').Controller}
 */
async function getServerTime(req) {
  return toItemResponse({
    time: Date.now(),
  }, { url: req.fullUrl });
}

/**
 * @type {import('../types').Controller}
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
 * @type {import('../types').Controller}
 */
async function getConfig(req) {
  const { config } = req.uwave;
  const { key } = req.params;
  const includeSchema = 'schema' in req.query;

  const values = await config.get(key);
  const combinedSchema = config.getSchema();
  const schema = combinedSchema.properties[key];

  return toItemResponse(values, {
    url: req.fullUrl,
    meta: includeSchema ? { schema } : {},
  });
}

/**
 * @type {import('../types').Controller}
 */
async function updateConfig(req) {
  const { config } = req.uwave;
  const { key } = req.params;
  const values = req.body;

  await config.set(key, values);

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

module.exports = {
  getServerTime,
  getAllConfig,
  getConfig,
  updateConfig,
};
