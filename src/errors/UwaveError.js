export default class UwaveError extends Error {
  /**
   * Whether this error message should be shown to users.
   */
  public = false;

  /**
   * Name.
   */
  name = 'UwaveError';

  /**
   * Flag this as a custom error class.
   */
  isUwaveError = true;
}
