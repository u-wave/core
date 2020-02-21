const UwaveError = require('./UwaveError');

class PermissionError extends UwaveError {
  constructor(message, { requiredRole }) {
    super(message);
    this.expose = true;
    this.name = 'PermissionError';
    this.code = 'NOT_ALLOWED';
    this.requiredRole = requiredRole;
  }
}

module.exports = PermissionError;
