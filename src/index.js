import Uwave from './Uwave';
import HttpApi from './HttpApi';
import SocketServer from './SocketServer';
import UwaveError from './errors/UwaveError';
import NotFoundError from './errors/NotFoundError';

export default function uwave(opts) {
  const uw = new Uwave(opts);
  const api = new HttpApi(uw, opts);
  const sockets = new SocketServer(uw, opts);
}

Object.assign(uwave, {
  Uwave,
  UwaveError,
  NotFoundError,
  HttpApi,
  SocketServer,
});
