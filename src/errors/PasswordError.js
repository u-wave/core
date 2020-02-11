const UwaveError = require('./UwaveError');

class PasswordError extends UwaveError {
  constructor(message) {
    super(message);
    this.expose = true;
    this.name = 'PasswordError';
    this.code = 'INCORRECT_PASSWORD';
  }
}

module.exports = PasswordError;
