'use strict';

class UwaveError extends Error {
  constructor(message) {
    super(message);
    /**
     * Whether this error message should be shown to users.
     */
    this.expose = false;

    /**
     * Name.
     */
    this.name = 'UwaveError';

    /**
     * Flag this as a custom error class.
     */
    this.isUwaveError = true;
  }
}

module.exports = UwaveError;
