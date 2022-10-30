'use strict';

const { finished } = require('stream');
const { NotFound } = require('http-errors');
const busboy = require('busboy');
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
 * @type {import('../types').AuthenticatedController}
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
 * @type {import('../types').AuthenticatedController<{ key: string }>}
 */
async function getConfig(req) {
  const { config } = req.uwave;
  const { key } = req.params;
  const includeSchema = 'schema' in req.query;

  const values = await config.get(key);
  const combinedSchema = config.getSchema();
  const schema = combinedSchema.properties[key];

  return toItemResponse(values ?? {}, {
    url: req.fullUrl,
    meta: includeSchema ? { schema } : {},
  });
}

/**
 * @type {import('../types').AuthenticatedController<{ key: string }>}
 */
async function updateConfig(req) {
  const { config } = req.uwave;
  const { key } = req.params;
  const values = req.body;

  await config.set(key, values, { user: req.user });

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

/**
 * @param {import('ajv').SchemaObject} schema
 * @param {string} path
 * @returns {import('ajv').SchemaObject|null}
 */
function getPath(schema, path) {
  const parts = path.split('.');
  let descended = schema;
  for (const part of parts) {
    descended = descended.properties[part];
    if (!descended) {
      return null;
    }
  }
  return descended;
}

/**
 * @type {import('../types').AuthenticatedController<{ key: string }, {}, never>}
 */
async function uploadFile(req) {
  const { config, assets } = req.uwave;
  const { key } = req.params;

  const combinedSchema = config.getSchema();
  const schema = getPath(combinedSchema, key);
  if (!schema) {
    throw new NotFound('Config key does not exist');
  }
  if (schema.type !== 'string' || schema.format !== 'asset') {
    throw new NotFound('Config key is not an asset');
  }

  const [content, meta] = await new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    bb.on('file', (name, file, info) => {
      if (name !== 'file') {
        return;
      }

      /** @type {Buffer[]} */
      const chunks = [];
      file.on('data', (chunk) => {
        chunks.push(chunk);
      });

      finished(file, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve([Buffer.concat(chunks), info]);
        }
      });
    });
    req.pipe(bb);
  });

  const path = await assets.store(meta.filename, content, {
    category: 'config',
    userID: req.user._id,
  });

  return toItemResponse({ path }, {
    url: req.fullUrl,
  });
}

module.exports = {
  getServerTime,
  getAllConfig,
  getConfig,
  updateConfig,
  uploadFile,
};
