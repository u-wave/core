'use strict';

const UwaveError = require('./UwaveError');

class NotFoundError extends UwaveError {
  constructor(message) {
    super(message);
    this.expose = true;
    this.name = 'NotFoundError';
    this.code = 'NOT_FOUND';
  }
}

module.exports = NotFoundError;
