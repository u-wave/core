import UwaveError from './UwaveError';

export default class NotFoundError extends UwaveError {
  expose = true;

  name = 'NotFoundError';

  code = 'NOT_FOUND';
}
