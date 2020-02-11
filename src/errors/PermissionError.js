const UwaveError = require('./UwaveError');

class PermissionError extends UwaveError {
  expose = true;

  name = 'PermissionError';

  code = 'NOT_ALLOWED';

  constructor(message, { requiredRole }) {
    super(message);
    this.requiredRole = requiredRole;
  }
}

module.exports = PermissionError;
