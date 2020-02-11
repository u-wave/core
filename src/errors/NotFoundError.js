const UwaveError = require('./UwaveError');

class NotFoundError extends UwaveError {
  expose = true;

  name = 'NotFoundError';

  code = 'NOT_FOUND';
}

module.exports = NotFoundError;
