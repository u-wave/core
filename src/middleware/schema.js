'use strict';

const Ajv = require('ajv/dist/2019').default;
const addFormats = require('ajv-formats').default;
const ValidationError = require('../errors/ValidationError');

const ajv = new Ajv({
  coerceTypes: false,
  removeAdditional: true,
  useDefaults: true,
  ownProperties: true,
  allErrors: true,
});
addFormats(ajv);
ajv.addMetaSchema(require('ajv/dist/refs/json-schema-draft-07.json'));
ajv.addSchema(require('../schemas/definitions.json'));

function alwaysTrue() {
  return true;
}

/**
 * @param {object} schemas
 * @prop {object} [schemas.body]
 * @prop {object} [schemas.params]
 * @prop {object} [schemas.query]
 */
function schema({ body, params, query }) {
  const validateBody = body ? ajv.compile(body) : alwaysTrue;
  const validateParams = params ? ajv.compile(params) : alwaysTrue;
  const validateQuery = query ? ajv.compile(query) : alwaysTrue;
  return (req, res, next) => {
    if (!validateParams(req.params)) {
      next(new ValidationError(validateParams.errors, ajv));
      return;
    }
    if (!validateQuery(req.query)) {
      next(new ValidationError(validateQuery.errors, ajv));
      return;
    }
    if (!validateBody(req.body)) {
      next(new ValidationError(validateBody.errors, ajv));
      return;
    }
    next();
  };
}

module.exports = schema;
