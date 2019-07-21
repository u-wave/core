import Uwave from './Uwave';
import HttpApi from './HttpApi';
import SocketServer from './SocketServer';
import UwaveError from './errors/UwaveError';
import NotFoundError from './errors/NotFoundError';

export default function uwave(opts) {
  return new Uwave(opts);
}

Object.assign(uwave, {
  Uwave,
  UwaveError,
  NotFoundError,
  HttpApi,
  SocketServer,
});
