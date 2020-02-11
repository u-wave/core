class UwaveError extends Error {
  /**
   * Whether this error message should be shown to users.
   */
  expose = false;

  /**
   * Name.
   */
  name = 'UwaveError';

  /**
   * Flag this as a custom error class.
   */
  isUwaveError = true;
}

module.exports = UwaveError;
