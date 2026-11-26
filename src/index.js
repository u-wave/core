import HttpApi from './HttpApi.js';
import SocketServer from './SocketServer.js';
import Uwave from './Uwave.js';

/**
 * @param {import('./Uwave.js').Options} opts
 * @returns {Uwave}
 */
export default function uwave(opts) {
  return new Uwave(opts);
}

export { HttpApi, SocketServer, Uwave };
