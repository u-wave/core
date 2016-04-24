import UwaveError from './UwaveError';

export default class NotFoundError extends UwaveError {
  name = 'NotFoundError';
  code = 'NOT_FOUND';
}
