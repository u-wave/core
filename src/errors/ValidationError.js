import UwaveError from './UwaveError';

export default class ValidationError extends UwaveError {
  public = true;

  name = 'ValidationError';

  code = 'SCHEMA_VALIDATION_FAILED';

  constructor(errors, ajv) {
    const message = ajv ? ajv.errorsText(errors) : 'Validation failed';
    super(message);

    this.errors = errors;
    this.ajv = ajv;
  }
}
