import EventEmitter from 'events';
import Ultron from 'ultron';
import WebSocket from 'ws';
import createDebug from 'debug';
import AuthRegistry from '../AuthRegistry';

const debug = createDebug('uwave:api:sockets:guest');

type ConnectionOptions = {
  timeout: number,
  authRegistry: AuthRegistry,
};

export default class GuestConnection extends EventEmitter {
  lastMessage = Date.now();

  constructor(uw, socket: WebSocket, req?, options: ConnectionOptions) {
    super();
    this.uw = uw;
    this.socket = socket;
    this.options = options;

    this.events = new Ultron(socket);

    this.events.on('close', () => {
      this.emit('close');
    });

    this.events.on('message', (token) => {
      this.attemptAuth(token).then(() => {
        this.send('authenticated');
      }).catch((error) => {
        this.send('error', error.message);
      });
    });
  }

  async attemptAuth(token) {
    const { users } = this.uw;
    const { authRegistry } = this.options;

    const userID = await authRegistry.getTokenUser(token);
    if (!userID) {
      throw new Error('Invalid token');
    }
    const userModel = await users.getUser(userID);
    if (!userModel) {
      throw new Error('Invalid session');
    }

    // Users who are banned can still join as guests, but cannot log in. So we
    // ignore their socket login attempts, and just keep their connections
    // around as guest connections.
    if (await userModel.isBanned()) {
      throw new Error('You have been banned');
    }

    this.emit('authenticate', userModel);
  }

  isReconnect(user) {
    return this.uw.redis.exists(`http-api:disconnected:${user.id}`);
  }

  send(command: string, data: any) {
    this.socket.send(JSON.stringify({ command, data }));
    this.lastMessage = Date.now();
  }

  ping() {
    if (Date.now() - this.lastMessage > 5000) {
      this.socket.send('-');
      this.lastMessage = Date.now();
    }
  }

  close() {
    debug('close');
    this.socket.close();
  }

  removed() {
    this.events.remove();
  }

  // eslint-disable-next-line class-methods-use-this
  toString() {
    return 'Guest';
  }
}
