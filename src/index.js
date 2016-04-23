import Uwave from './Uwave';

module.exports = function uwave(opts) {
  return new Uwave(opts);
};

module.exports.Uwave = Uwave;
