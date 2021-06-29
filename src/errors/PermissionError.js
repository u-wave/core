'use strict';

const UwaveError = require('./UwaveError');

/**
 * @deprecated
 */
class PermissionError extends UwaveError {
  /**
   * @param {string} message
   * @param {{ requiredRole: string }} options
   */
  constructor(message, { requiredRole }) {
    super(message);
    this.expose = true;
    this.name = 'PermissionError';
    this.code = 'NOT_ALLOWED';
    this.requiredRole = requiredRole;
  }
}

module.exports = PermissionError;
