/**
 * @deprecated
 */
class UwaveError extends Error {
  /**
   * @param {string} message
   */
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

export default UwaveError;
