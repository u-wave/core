import UwaveError from './UwaveError';

export default class NotFoundError extends UwaveError {
  public = true;

  name = 'NotFoundError';

  code = 'NOT_FOUND';
}
