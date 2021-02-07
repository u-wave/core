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

function schema({ body, params, query }) {
  const validateBody = body ? ajv.compile(body) : alwaysTrue;
  const validateParams = params ? ajv.compile(params) : alwaysTrue;
  const validateQuery = query ? ajv.compile(query) : alwaysTrue;
  return (req, res, next) => {
    if (!validateParams(req.params)) {
      return next(new ValidationError(validateParams.errors, ajv));
    }
    if (!validateQuery(req.query)) {
      return next(new ValidationError(validateQuery.errors, ajv));
    }
    if (!validateBody(req.body)) {
      return next(new ValidationError(validateBody.errors, ajv));
    }
    next();
  };
}

module.exports = schema;
