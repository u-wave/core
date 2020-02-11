const UwaveError = require('./UwaveError');

class PasswordError extends UwaveError {
  expose = true;

  name = 'PasswordError';

  code = 'INCORRECT_PASSWORD';
}

module.exports = PasswordError;
