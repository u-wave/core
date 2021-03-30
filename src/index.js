'use strict';

const Uwave = require('./Uwave');
const HttpApi = require('./HttpApi');
const SocketServer = require('./SocketServer');

/**
 * @param {Uwave.Options} opts
 */
module.exports = function uwave(opts) {
  return new Uwave(opts);
};

Object.assign(module.exports, {
  Uwave,
  HttpApi,
  SocketServer,
});
