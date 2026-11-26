import ajvFormats from 'ajv-formats';
import { Ajv2019 as Ajv } from 'ajv/dist/2019.js';
import assert from 'node:assert';
import fs from 'node:fs';
import ValidationError from '../errors/ValidationError.js';

const ajv = new Ajv({
  coerceTypes: false,
  removeAdditional: true,
  useDefaults: true,
  ownProperties: true,
  allErrors: true,
});
ajvFormats.default(ajv);
ajv.addMetaSchema(
  JSON.parse(fs.readFileSync(new URL(import.meta.resolve('ajv/dist/refs/json-schema-draft-07.json')), 'utf8')),
);
ajv.addSchema(JSON.parse(fs.readFileSync(new URL(import.meta.resolve('../schemas/definitions.json')), 'utf8')));

const alwaysTrue = Object.assign(function() {
  return true;
}, { errors: null });

/**
 * @template T
 * @param {T | null | undefined} t
 * @returns {T}
 */
function assertNotNull(t) {
  assert(t, 'Unexpected null');
  return t;
}

/**
 * @typedef {object} Schemas
 * @property {import('ajv').SchemaObject} [body]
 * @property {import('ajv').SchemaObject} [params]
 * @property {import('ajv').SchemaObject} [query]
 * @param {Schemas} schemas
 * @returns {import('express').RequestHandler}
 */
function schema({ body, params, query }) {
  const validateBody = body ? ajv.compile(body) : alwaysTrue;
  const validateParams = params ? ajv.compile(params) : alwaysTrue;
  const validateQuery = query ? ajv.compile(query) : alwaysTrue;
  return (req, res, next) => {
    if (!validateParams(req.params)) {
      next(new ValidationError(assertNotNull(validateParams.errors), ajv));
      return;
    }
    if (!validateQuery(req.query)) {
      next(new ValidationError(assertNotNull(validateQuery.errors), ajv));
      return;
    }
    if (!validateBody(req.body)) {
      next(new ValidationError(assertNotNull(validateBody.errors), ajv));
      return;
    }
    next();
  };
}

export default schema;
