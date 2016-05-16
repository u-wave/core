import Uwave from './Uwave';
import UwaveError from './errors/UwaveError';
import NotFoundError from './errors/NotFoundError';

module.exports = function uwave(opts) {
  return new Uwave(opts);
};

Object.assign(module.exports, {
  Uwave,
  UwaveError,
  NotFoundError
});
