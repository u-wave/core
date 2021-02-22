'use strict';

const UwaveError = require('./UwaveError');

class ValidationError extends UwaveError {
  constructor(errors, ajv) {
    const message = ajv ? ajv.errorsText(errors) : 'Validation failed';
    super(message);

    this.expose = true;
    this.name = 'ValidationError';
    this.code = 'SCHEMA_VALIDATION_FAILED';

    this.errors = errors;
    this.ajv = ajv;
  }
}

module.exports = ValidationError;
