import UwaveError from './UwaveError';

export default class PermissionError extends UwaveError {
  public = true;

  name = 'PermissionError';

  code = 'NOT_ALLOWED';

  constructor(message, { requiredRole }) {
    super(message);
    this.requiredRole = requiredRole;
  }
}
