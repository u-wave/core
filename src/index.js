const Uwave = require('./Uwave');
const HttpApi = require('./HttpApi');
const SocketServer = require('./SocketServer');
const UwaveError = require('./errors/UwaveError');
const NotFoundError = require('./errors/NotFoundError');

module.exports = function uwave(opts) {
  return new Uwave(opts);
};

Object.assign(module.exports, {
  Uwave,
  UwaveError,
  NotFoundError,
  HttpApi,
  SocketServer,
});
