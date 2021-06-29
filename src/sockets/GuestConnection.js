'use strict';

const EventEmitter = require('events');
const Ultron = require('ultron');
const createDebug = require('debug');

const debug = createDebug('uwave:api:sockets:guest');

class GuestConnection extends EventEmitter {
  /**
   * @param {import('../Uwave')} uw
   * @param {import('ws')} socket
   * @param {{ authRegistry: import('../AuthRegistry') }} options
   */
  constructor(uw, socket, options) {
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

    this.lastMessage = Date.now();
  }

  /**
   * @param {string} token
   */
  async attemptAuth(token) {
    const { bans, users } = this.uw;
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
    if (await bans.isBanned(userModel)) {
      throw new Error('You have been banned');
    }

    this.emit('authenticate', userModel);
  }

  /**
   * @param {import('../models').User} user
   */
  isReconnect(user) {
    return this.uw.redis.exists(`http-api:disconnected:${user.id}`);
  }

  /**
   * @param {string} command
   * @param {import('type-fest').JsonValue} [data]
   */
  send(command, data) {
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

module.exports = GuestConnection;
