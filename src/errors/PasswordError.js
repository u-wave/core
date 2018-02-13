import UwaveError from './UwaveError';

export default class PasswordError extends UwaveError {
  public = true;
  name = 'PasswordError';
  code = 'INCORRECT_PASSWORD';
}
