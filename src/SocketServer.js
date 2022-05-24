'use strict';

const { promisify } = require('util');
const { debounce, isEmpty } = require('lodash');
const sjson = require('secure-json-parse');
const WebSocket = require('ws');
const Ajv = require('ajv').default;
const ms = require('ms');
const { stdSerializers } = require('pino');
const { socketVote } = require('./controllers/booth');
const { disconnectUser } = require('./controllers/users');
const AuthRegistry = require('./AuthRegistry');
const GuestConnection = require('./sockets/GuestConnection');
const AuthedConnection = require('./sockets/AuthedConnection');
const LostConnection = require('./sockets/LostConnection');
const { serializeUser } = require('./utils/serialize');

/**
 * @typedef {import('./models').User} User
 */

/**
 * @typedef {GuestConnection | AuthedConnection | LostConnection} Connection
 */

/**
 * @typedef {object} ClientActionParameters
 * @prop {string} sendChat
 * @prop {-1 | 1} vote
 * @prop {undefined} logout
 */

/**
 * @typedef {{
 *   [Name in keyof ClientActionParameters]: (
 *     user: User,
 *     parameter: ClientActionParameters[Name],
 *     connection: AuthedConnection
 *   ) => void
 * }} ClientActions
 */

const ajv = new Ajv({
  coerceTypes: false,
  ownProperties: true,
  removeAdditional: true,
  useDefaults: false,
});

function missingServerOption() {
  return new TypeError(`
Exactly one of "options.server" and "options.port" is required. These
options are used to attach the WebSocket server to the correct HTTP server.

An example of how to attach the WebSocket server to an existing HTTP server
using Express:

    const { createSocketServer } = require('u-wave-http-api');
    const app = express();
    const server = app.listen(80);

    createSocketServer(uwave, {
      server: server,
      /* ... */
    });

Alternatively, you can provide a port for the socket server to listen on:

    const { createSocketServer } = require('u-wave-http-api');
    const app = express();

    createSocketServer(uwave, {
      port: 6042,
      /* ... */
    });
  `);
}

/**
 * @template {object} T
 * @param {T} object
 * @param {PropertyKey} property
 * @returns {property is keyof T}
 */
function has(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

class SocketServer {
  /**
   * @param {import('./Uwave').Boot} uw
   * @param {{ secret: Buffer|string }} options
   */
  static async plugin(uw, options) {
    uw.socketServer = new SocketServer(uw, {
      secret: options.secret,
      server: uw.server,
    });

    uw.after(async () => {
      await uw.socketServer.initLostConnections();
    });

    uw.onClose(async () => {
      await uw.socketServer.destroy();
    });
  }

  #uw;

  #logger;

  #redisSubscription;

  #wss;

  /** @type {Connection[]} */
  #connections = [];

  #pinger;

  /**
   * Handlers for commands that come in from clients.
   * @type {ClientActions}
   */
  #clientActions;

  /**
   * @type {{
   *   [K in keyof ClientActionParameters]:
   *     import('ajv').ValidateFunction<ClientActionParameters[K]>
   * }}
   */
  #clientActionSchemas;

  /**
   * Handlers for commands that come in from the server side.
   *
   * @type {import('./redisMessages').ServerActions}
   */
  #serverActions;

  /**
   * Create a socket server.
   *
   * @param {import('./Uwave')} uw üWave Core instance.
   * @param {object} options Socket server options.
   * @param {number} [options.timeout] Time in seconds to wait for disconnected
   *     users to reconnect before removing them.
   * @param {Buffer|string} options.secret
   * @param {import('http').Server | import('https').Server} [options.server]
   * @param {number} [options.port]
   */
  constructor(uw, options) {
    if (!uw || !('mongo' in uw)) {
      throw new TypeError('Expected a u-wave-core instance in the first parameter. If you are '
        + 'developing, you may have to upgrade your u-wave-* modules.');
    }

    if (!options.server && !options.port) {
      throw missingServerOption();
    }

    if (!options.secret) {
      throw new TypeError('"options.secret" is empty. This option is used to sign authentication '
        + 'keys, and is required for security reasons.');
    }

    this.#uw = uw;
    this.#logger = uw.logger.child({ ns: 'uwave:sockets' }, {
      serializers: {
        req: stdSerializers.req,
      },
    });
    this.#redisSubscription = uw.redis.duplicate();

    this.options = {
      /** @type {(_socket: import('ws') | undefined, err: Error) => void} */
      onError: (_socket, err) => {
        throw err;
      },
      timeout: 30,
      ...options,
    };

    // TODO put this behind a symbol, it's just public for tests
    this.authRegistry = new AuthRegistry(uw.redis);

    this.#wss = new WebSocket.Server({
      server: options.server,
      port: options.server ? undefined : options.port,
    });

    this.#redisSubscription.subscribe('uwave', 'v1').catch((error) => {
      this.#logger.error(error);
    });
    this.#redisSubscription.on('message', (channel, command) => {
      // this returns a promise, but we don't handle the error case:
      // there is not much we can do, so just let node.js crash w/ an unhandled rejection
      this.onServerMessage(channel, command);
    });

    this.#wss.on('error', (error) => {
      this.onError(error);
    });
    this.#wss.on('connection', (socket, request) => {
      this.onSocketConnected(socket, request);
    });

    this.#pinger = setInterval(() => {
      this.ping();
    }, ms('10 seconds'));

    this.recountGuests = debounce(() => {
      this.recountGuestsInternal().catch((error) => {
        this.#logger.error({ err: error }, 'counting guests failed');
      });
    }, ms('2 seconds'));

    this.#clientActions = {
      sendChat: (user, message) => {
        this.#logger.trace({ user, message }, 'sendChat');
        this.#uw.chat.send(user, message);
      },
      vote: (user, direction) => {
        socketVote(this.#uw, user.id, direction);
      },
      logout: (user, _, connection) => {
        this.replace(connection, this.createGuestConnection(connection.socket));
        if (!this.connection(user)) {
          disconnectUser(this.#uw, user._id);
        }
      },
    };

    this.#clientActionSchemas = {
      sendChat: ajv.compile({
        type: 'string',
      }),
      vote: ajv.compile({
        type: 'integer',
        enum: [-1, 1],
      }),
      logout: ajv.compile(true),
    };

    this.#serverActions = {
      /**
       * Broadcast the next track.
       */
      'advance:complete': (next) => {
        if (next) {
          this.broadcast('advance', {
            historyID: next.historyID,
            userID: next.userID,
            itemID: next.itemID,
            media: next.media,
            playedAt: new Date(next.playedAt).getTime(),
          });
        } else {
          this.broadcast('advance', null);
        }
      },
      /**
       * Broadcast a skip notification.
       */
      'booth:skip': ({ moderatorID, userID, reason }) => {
        this.broadcast('skip', { moderatorID, userID, reason });
      },
      /**
       * Broadcast a chat message.
       */
      'chat:message': (message) => {
        this.broadcast('chatMessage', message);
      },
      /**
       * Delete chat messages. The delete filter can have an _id property to
       * delete a specific message, a userID property to delete messages by a
       * user, or be empty to delete all messages.
       */
      'chat:delete': ({ moderatorID, filter }) => {
        if ('id' in filter) {
          this.broadcast('chatDeleteByID', {
            moderatorID,
            _id: filter.id,
          });
        } else if ('userID' in filter) {
          this.broadcast('chatDeleteByUser', {
            moderatorID,
            userID: filter.userID,
          });
        } else if (isEmpty(filter)) {
          this.broadcast('chatDelete', { moderatorID });
        }
      },
      /**
       * Broadcast that a user was muted in chat.
       */
      'chat:mute': ({ moderatorID, userID, duration }) => {
        this.broadcast('chatMute', {
          userID,
          moderatorID,
          expiresAt: Date.now() + duration,
        });
      },
      /**
       * Broadcast that a user was unmuted in chat.
       */
      'chat:unmute': ({ moderatorID, userID }) => {
        this.broadcast('chatUnmute', { userID, moderatorID });
      },
      /**
       * Broadcast a vote for the current track.
       */
      'booth:vote': ({ userID, direction }) => {
        this.broadcast('vote', {
          _id: userID,
          value: direction,
        });
      },
      /**
       * Broadcast a favorite for the current track.
       */
      'booth:favorite': ({ userID }) => {
        this.broadcast('favorite', { userID });
      },
      /**
       * Cycle a single user's playlist.
       */
      'playlist:cycle': ({ userID, playlistID }) => {
        this.sendTo(userID, 'playlistCycle', { playlistID });
      },
      /**
       * Broadcast that a user joined the waitlist.
       */
      'waitlist:join': ({ userID, waitlist }) => {
        this.broadcast('waitlistJoin', { userID, waitlist });
      },
      /**
       * Broadcast that a user left the waitlist.
       */
      'waitlist:leave': ({ userID, waitlist }) => {
        this.broadcast('waitlistLeave', { userID, waitlist });
      },
      /**
       * Broadcast that a user was added to the waitlist.
       */
      'waitlist:add': ({
        userID, moderatorID, position, waitlist,
      }) => {
        this.broadcast('waitlistAdd', {
          userID, moderatorID, position, waitlist,
        });
      },
      /**
       * Broadcast that a user was removed from the waitlist.
       */
      'waitlist:remove': ({ userID, moderatorID, waitlist }) => {
        this.broadcast('waitlistRemove', { userID, moderatorID, waitlist });
      },
      /**
       * Broadcast that a user was moved in the waitlist.
       */
      'waitlist:move': ({
        userID, moderatorID, position, waitlist,
      }) => {
        this.broadcast('waitlistMove', {
          userID, moderatorID, position, waitlist,
        });
      },
      /**
       * Broadcast a waitlist update.
       */
      'waitlist:update': (waitlist) => {
        this.broadcast('waitlistUpdate', waitlist);
      },
      /**
       * Broadcast that the waitlist was cleared.
       */
      'waitlist:clear': ({ moderatorID }) => {
        this.broadcast('waitlistClear', { moderatorID });
      },
      /**
       * Broadcast that the waitlist was locked.
       */
      'waitlist:lock': ({ moderatorID, locked }) => {
        this.broadcast('waitlistLock', { moderatorID, locked });
      },

      'acl:allow': ({ userID, roles }) => {
        this.broadcast('acl:allow', { userID, roles });
      },
      'acl:disallow': ({ userID, roles }) => {
        this.broadcast('acl:disallow', { userID, roles });
      },

      'user:update': ({ userID, moderatorID, new: update }) => {
        // TODO Remove this remnant of the old roles system
        if ('role' in update) {
          this.broadcast('roleChange', {
            moderatorID,
            userID,
            role: update.role,
          });
        }
        if ('username' in update) {
          this.broadcast('nameChange', {
            moderatorID,
            userID,
            username: update.username,
          });
        }
      },
      'user:join': async ({ userID }) => {
        const { users, redis } = this.#uw;
        const user = await users.getUser(userID);
        if (user) {
          // TODO this should not be the socket server code's responsibility
          await redis.rpush('users', user.id);
          this.broadcast('join', serializeUser(user));
        }
      },
      /**
       * Broadcast that a user left the server.
       */
      'user:leave': ({ userID }) => {
        this.broadcast('leave', userID);
      },
      /**
       * Broadcast a ban event.
       */
      'user:ban': ({
        moderatorID, userID, permanent, duration, expiresAt,
      }) => {
        this.broadcast('ban', {
          moderatorID, userID, permanent, duration, expiresAt,
        });

        this.#connections.forEach((connection) => {
          if (connection instanceof AuthedConnection && connection.user.id === userID) {
            connection.ban();
          } else if (connection instanceof LostConnection && connection.user.id === userID) {
            connection.close();
          }
        });
      },
      /**
       * Broadcast an unban event.
       */
      'user:unban': ({ moderatorID, userID }) => {
        this.broadcast('unban', { moderatorID, userID });
      },
      /**
       * Force-close a connection.
       */
      'http-api:socket:close': (userID) => {
        this.#connections.forEach((connection) => {
          if ('user' in connection && connection.user.id === userID) {
            connection.close();
          }
        });
      },
    };
  }

  /**
   * Create `LostConnection`s for every user that's known to be online, but that
   * is not currently connected to the socket server.
   * @private
   */
  async initLostConnections() {
    const { User } = this.#uw.models;
    const userIDs = await this.#uw.redis.lrange('users', 0, -1);
    const disconnectedIDs = userIDs.filter((userID) => !this.connection(userID));

    /** @type {User[]} */
    const disconnectedUsers = await User.where('_id').in(disconnectedIDs);
    disconnectedUsers.forEach((user) => {
      this.add(this.createLostConnection(user));
    });
  }

  /**
   * @param {import('ws')} socket
   * @param {import('http').IncomingMessage} request
   * @private
   */
  onSocketConnected(socket, request) {
    this.#logger.info({ req: request }, 'new connection');

    socket.on('error', (error) => {
      this.onSocketError(socket, error);
    });
    this.add(this.createGuestConnection(socket));
  }

  /**
   * @param {import('ws')} socket
   * @param {Error} error
   * @private
   */
  onSocketError(socket, error) {
    this.#logger.warn({ err: error }, 'socket error');

    this.options.onError(socket, error);
  }

  /**
   * @param {Error} error
   * @private
   */
  onError(error) {
    this.#logger.error({ err: error }, 'server error');

    this.options.onError(undefined, error);
  }

  /**
   * Get a LostConnection for a user, if one exists.
   *
   * @param {User} user
   * @private
   */
  getLostConnection(user) {
    return this.#connections.find((connection) => (
      connection instanceof LostConnection && connection.user.id === user.id
    ));
  }

  /**
   * Create a connection instance for an unauthenticated user.
   *
   * @param {import('ws')} socket
   * @private
   */
  createGuestConnection(socket) {
    const connection = new GuestConnection(this.#uw, socket, {
      authRegistry: this.authRegistry,
    });
    connection.on('close', () => {
      this.remove(connection);
    });
    connection.on('authenticate', async (user) => {
      const isReconnect = await connection.isReconnect(user);
      this.#logger.info({ userId: user.id, isReconnect }, 'authenticated socket');
      if (isReconnect) {
        const previousConnection = this.getLostConnection(user);
        if (previousConnection) this.remove(previousConnection);
      }

      this.replace(connection, this.createAuthedConnection(socket, user));

      if (!isReconnect) {
        this.#uw.publish('user:join', { userID: user.id });
      }
    });
    return connection;
  }

  /**
   * Create a connection instance for an authenticated user.
   *
   * @param {WebSocket} socket
   * @param {User} user
   * @returns {AuthedConnection}
   * @private
   */
  createAuthedConnection(socket, user) {
    const connection = new AuthedConnection(this.#uw, socket, user);
    connection.on('close', ({ banned }) => {
      if (banned) {
        this.#logger.info({ userId: user.id }, 'removing connection after ban');
        this.remove(connection);
        disconnectUser(this.#uw, user._id);
      } else {
        this.#logger.info({ userId: user.id }, 'lost connection');
        this.replace(connection, this.createLostConnection(user));
      }
    });
    connection.on(
      'command',
      /**
       * @param {string} command
       * @param {import('type-fest').JsonValue} data
       */
      (command, data) => {
        this.#logger.trace({ userId: user.id, command, data }, 'command');
        if (has(this.#clientActions, command)) {
          // Ignore incorrect input
          const validate = this.#clientActionSchemas[command];
          if (validate && !validate(data)) {
            return;
          }

          const action = this.#clientActions[command];
          // @ts-expect-error TS2345 `data` is validated
          action(user, data, connection);
        }
      },
    );
    return connection;
  }

  /**
   * Create a connection instance for a user who disconnected.
   *
   * @param {User} user
   * @returns {LostConnection}
   * @private
   */
  createLostConnection(user) {
    const connection = new LostConnection(this.#uw, user, this.options.timeout);
    connection.on('close', () => {
      this.#logger.info({ userId: user.id }, 'user left');
      this.remove(connection);
      // Only register that the user left if they didn't have another connection
      // still open.
      if (!this.connection(user)) {
        disconnectUser(this.#uw, user._id);
      }
    });
    return connection;
  }

  /**
   * Add a connection.
   *
   * @param {Connection} connection
   * @private
   */
  add(connection) {
    const userId = 'user' in connection ? connection.user.id : null;
    this.#logger.trace({ type: connection.constructor.name, userId }, 'add connection');

    this.#connections.push(connection);
    this.recountGuests();
  }

  /**
   * Remove a connection.
   *
   * @param {Connection} connection
   * @private
   */
  remove(connection) {
    const userId = 'user' in connection ? connection.user.id : null;
    this.#logger.trace({ type: connection.constructor.name, userId }, 'remove connection');

    const i = this.#connections.indexOf(connection);
    this.#connections.splice(i, 1);

    connection.removed();
    this.recountGuests();
  }

  /**
   * Replace a connection instance with another connection instance. Useful when
   * a connection changes "type", like GuestConnection → AuthedConnection.
   *
   * @param {Connection} oldConnection
   * @param {Connection} newConnection
   * @private
   */
  replace(oldConnection, newConnection) {
    this.remove(oldConnection);
    this.add(newConnection);
  }

  /**
   * Handle command messages coming in from Redis.
   * Some commands are intended to broadcast immediately to all connected
   * clients, but others require special action.
   *
   * @param {string} channel
   * @param {string} rawCommand
   * @return {Promise<void>}
   * @private
   */
  async onServerMessage(channel, rawCommand) {
    /**
     * @type {{ command: string, data: import('type-fest').JsonValue }|undefined}
     */
    const json = sjson.safeParse(rawCommand);
    if (!json) {
      return;
    }
    const { command, data } = json;

    this.#logger.trace({ channel, command, data }, 'server message');

    if (channel === 'v1') {
      this.broadcast(command, data);
    } else if (channel === 'uwave') {
      if (has(this.#serverActions, command)) {
        const action = this.#serverActions[command];
        if (action !== undefined) { // the types for `ServerActions` allow undefined, so...
          // @ts-expect-error TS2345 `data` is validated
          action(data);
        }
      }
    }
  }

  /**
   * Stop the socket server.
   *
   * @return {Promise<void>}
   */
  async destroy() {
    clearInterval(this.#pinger);

    for (const connection of this.#wss.clients) {
      connection.terminate();
    }

    const closeWsServer = promisify(this.#wss.close.bind(this.#wss));
    await closeWsServer();
    await this.#redisSubscription.quit();
  }

  /**
   * Get the connection instance for a specific user.
   *
   * @param {User|string} user The user.
   * @return {Connection|undefined}
   */
  connection(user) {
    const userID = typeof user === 'object' ? user.id : user;
    return this.#connections.find((connection) => 'user' in connection && connection.user.id === userID);
  }

  ping() {
    this.#connections.forEach((connection) => {
      if ('socket' in connection) {
        connection.ping();
      }
    });
  }

  /**
   * Broadcast a command to all connected clients.
   *
   * @param {string} command Command name.
   * @param {import('type-fest').JsonValue} data Command data.
   */
  broadcast(command, data) {
    this.#logger.trace({
      command,
      data,
      to: this.#connections.map((connection) => (
        'user' in connection ? connection.user.id : null
      )),
    }, 'broadcast');

    this.#connections.forEach((connection) => {
      connection.send(command, data);
    });
  }

  /**
   * Send a command to a single user.
   *
   * @param {User|string} user User or user ID to send the command to.
   * @param {string} command Command name.
   * @param {import('type-fest').JsonValue} data Command data.
   */
  sendTo(user, command, data) {
    const userID = typeof user === 'object' ? user.id : user;

    this.#connections.forEach((connection) => {
      if ('user' in connection && connection.user.id === userID) {
        connection.send(command, data);
      }
    });
  }

  async getGuestCount() {
    const { redis } = this.#uw;
    const rawCount = await redis.get('http-api:guests');
    if (typeof rawCount !== 'string' || !/^\d+$/.test(rawCount)) {
      return 0;
    }
    return parseInt(rawCount, 10);
  }

  /**
   * Update online guests count and broadcast an update if necessary.
   *
   * @private
   */
  recountGuests() { // eslint-disable-line class-methods-use-this
    // assigned in constructor()
  }

  /** @private */
  async recountGuestsInternal() {
    const { redis } = this.#uw;
    const guests = this.#connections
      .filter((connection) => connection instanceof GuestConnection)
      .length;

    const lastGuestCount = await this.getGuestCount();
    if (guests !== lastGuestCount) {
      await redis.set('http-api:guests', guests);
      this.broadcast('guests', guests);
    }
  }
}

module.exports = SocketServer;
