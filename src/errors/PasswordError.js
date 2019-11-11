import UwaveError from './UwaveError';

export default class PasswordError extends UwaveError {
  expose = true;

  name = 'PasswordError';

  code = 'INCORRECT_PASSWORD';
}
