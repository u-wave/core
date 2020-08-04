const { debounce, isEmpty } = require('lodash');
const tryJsonParse = require('try-json-parse');
const WebSocket = require('ws');
const ms = require('ms');
const createDebug = require('debug');
const { socketVote } = require('./controllers/booth');
const { disconnectUser } = require('./controllers/users');
const AuthRegistry = require('./AuthRegistry');
const GuestConnection = require('./sockets/GuestConnection');
const AuthedConnection = require('./sockets/AuthedConnection');
const LostConnection = require('./sockets/LostConnection');

const debug = createDebug('uwave:api:sockets');

function missingServerOption() {
  throw new TypeError(`
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

class SocketServer {
  /**
   * Create a socket server.
   *
   * @param {Uwave} uw üWave Core instance.
   * @param {object} options Socket server options.
   * @param {number} options.timeout Time in seconds to wait for disconnected
   *     users to reconnect before removing them.
   */
  constructor(uw, options = {}) {
    if (!uw || !('mongo' in uw)) {
      throw new TypeError('Expected a u-wave-core instance in the first parameter. If you are '
        + 'developing, you may have to upgrade your u-wave-* modules.');
    }

    if (!options.server && !options.port) {
      missingServerOption(options);
    }

    if (!options.secret) {
      throw new TypeError('"options.secret" is empty. This option is used to sign authentication '
        + 'keys, and is required for security reasons.');
    }

    this.uw = uw;
    this.redisSubscription = uw.redis.duplicate();

    this.connections = [];

    this.options = {
      onError: (socket, err) => {
        throw err;
      },
      timeout: 30,
      ...options,
    };

    this.authRegistry = new AuthRegistry(uw.redis);

    this.wss = new WebSocket.Server({
      server: options.server,
      port: options.server ? null : options.port,
      clientTracking: false,
    });

    this.redisSubscription.on('ready', () => {
      this.redisSubscription.subscribe('uwave', 'v1');
    });
    this.redisSubscription.on('message', (channel, command) => {
      this.onServerMessage(channel, command)
        .catch((e) => { throw e; });
    });

    this.wss.on('error', (error) => {
      this.onError(error);
    });
    this.wss.on('connection', (socket, req) => {
      this.onSocketConnected(socket, req);
    });

    this.initLostConnections();

    this.pinger = setInterval(() => {
      this.ping();
    }, ms('10 seconds'));

    this.recountGuests = debounce(() => {
      this.recountGuestsInternal().catch((error) => {
        debug('counting guests failed:', error);
      });
    }, ms('2 seconds'));

    /**
     * Handlers for commands that come in from clients.
     */
    this.clientActions = {
      sendChat: (user, message) => {
        debug('sendChat', user, message);
        this.uw.chat.send(user, message);
      },
      vote: (user, direction) => {
        socketVote(this.uw, user.id, direction);
      },
      logout: (user, _, connection) => {
        this.replace(connection, this.createGuestConnection(connection.socket, null));
        if (!this.connection(user)) {
          disconnectUser(this.uw, user);
        }
      },
    };

    /**
     * Handlers for commands that come in from the server side.
     */
    this.serverActions = {
      /**
       * Broadcast the next track.
       */
      'advance:complete': (next) => {
        if (next) {
          this.broadcast('advance', {
            historyID: next._id,
            userID: next.user._id,
            item: next.item._id,
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
        if (filter.id) {
          this.broadcast('chatDeleteByID', {
            moderatorID,
            _id: filter.id,
          });
        } else if (filter.userID) {
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
        const { users, redis } = this.uw;
        const user = await users.getUser(userID);
        await redis.rpush('users', user.id);
        this.broadcast('join', user.toJSON());
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

        this.connections.forEach((connection) => {
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
        this.connections.forEach((connection) => {
          if (connection.user && connection.user.id === userID) {
            connection.close();
          }
        });
      },
    };
  }

  /**
   * Create `LostConnection`s for every user that's known to be online, but that
   * is not currently connected to the socket server.
   */
  async initLostConnections() {
    const { User } = this.uw.models;
    const userIDs = await this.uw.redis.lrange('users', 0, -1);
    const disconnectedIDs = userIDs.filter((userID) => !this.connection(userID));

    const disconnectedUsers = await User.where('_id').in(disconnectedIDs);
    disconnectedUsers.forEach((user) => {
      this.add(this.createLostConnection(user));
    });
  }

  onSocketConnected(socket, req) {
    debug('new connection');

    socket.on('error', (error) => {
      this.onSocketError(socket, error);
    });
    this.add(this.createGuestConnection(socket, req));
  }

  onSocketError(socket, error) {
    debug('socket error:', error);

    this.options.onError(socket, error);
  }

  onError(error) {
    debug('server error:', error);

    this.options.onError(null, error);
  }

  /**
   * Get a LostConnection for a user, if one exists.
   */
  getLostConnection(user) {
    return this.connections.find((connection) => (
      connection instanceof LostConnection && connection.user.id === user.id
    ));
  }

  /**
   * Create a connection instance for an unauthenticated user.
   */
  createGuestConnection(socket, req) {
    const connection = new GuestConnection(this.uw, socket, req, {
      secret: this.options.secret,
      authRegistry: this.authRegistry,
    });
    connection.on('close', () => {
      this.remove(connection);
    });
    connection.on('authenticate', async (user, token) => {
      debug('connecting', user.id, user.username);
      if (await connection.isReconnect(user)) {
        debug('is reconnection');
        const previousConnection = this.getLostConnection(user);
        if (previousConnection) this.remove(previousConnection);
      } else {
        this.uw.publish('user:join', { userID: user.id });
      }

      this.replace(connection, this.createAuthedConnection(socket, user, token));
    });
    return connection;
  }

  /**
   * Create a connection instance for an authenticated user.
   */
  createAuthedConnection(socket, user, token) {
    const connection = new AuthedConnection(this.uw, socket, user, token);
    connection.on('close', ({ banned }) => {
      if (banned) {
        debug('removing connection after ban', user.id, user.username);
        this.remove(connection);
        disconnectUser(this.uw, user);
      } else {
        debug('lost connection', user.id, user.username);
        this.replace(connection, this.createLostConnection(user));
      }
    });
    connection.on('command', (command, data) => {
      debug('command', user.id, user.username, command, data);
      const action = this.clientActions[command];
      if (action) {
        action(user, data, connection);
      }
    });
    return connection;
  }

  /**
   * Create a connection instance for a user who disconnected.
   */
  createLostConnection(user) {
    const connection = new LostConnection(this.uw, user, this.options.timeout);
    connection.on('close', () => {
      debug('left', user.id, user.username);
      this.remove(connection);
      // Only register that the user left if they didn't have another connection
      // still open.
      if (!this.connection(user)) {
        disconnectUser(this.uw, user);
      }
    });
    return connection;
  }

  /**
   * Add a connection.
   */
  add(connection) {
    debug('adding', String(connection));

    this.connections.push(connection);
    this.recountGuests();
  }

  /**
   * Remove a connection.
   */
  remove(connection) {
    debug('removing', String(connection));

    const i = this.connections.indexOf(connection);
    this.connections.splice(i, 1);

    connection.removed();
    this.recountGuests();
  }

  /**
   * Replace a connection instance with another connection instance. Useful when
   * a connection changes "type", like GuestConnection → AuthedConnection.
   */
  replace(oldConnection, newConnection) {
    this.remove(oldConnection);
    this.add(newConnection);
  }

  /**
   * Handle command messages coming in from Redis.
   * Some commands are intended to broadcast immediately to all connected
   * clients, but others require special action.
   */
  async onServerMessage(channel, rawCommand) {
    const { command, data } = tryJsonParse(rawCommand) || {};

    if (channel === 'v1') {
      this.broadcast(command, data);
    } else if (channel === 'uwave') {
      const action = this.serverActions[command];
      if (action) {
        action(data);
      }
    }
  }

  /**
   * Stop the socket server.
   */
  async destroy() {
    clearInterval(this.pinger);
    this.wss.close();
    this.redisSubscription.quit();
  }

  /**
   * Get the connection instance for a specific user.
   *
   * @param {object|string} user The user.
   * @return {Connection}
   */
  connection(user) {
    const userID = typeof user === 'object' ? user.id : user;
    return this.connections.find((connection) => connection.user && connection.user.id === userID);
  }

  ping() {
    this.connections.forEach((connection) => {
      if (connection.socket) {
        connection.ping();
      }
    });
  }

  /**
   * Broadcast a command to all connected clients.
   *
   * @param {string} command Command name.
   * @param {*} data Command data.
   */
  broadcast(command, data) {
    debug('broadcast', command, data);

    this.connections.forEach((connection) => {
      debug('  to', connection.toString());
      connection.send(command, data);
    });
  }

  /**
   * Send a command to a single user.
   *
   * @param {Object|string} user User or user ID to send the command to.
   * @param {string} command Command name.
   * @param {*} data Command data.
   */
  sendTo(user, command, data) {
    const userID = typeof user === 'object' ? user.id : user;

    this.connections.forEach((connection) => {
      if (connection.user && connection.user.id === userID) {
        connection.send(command, data);
      }
    });
  }

  async getGuestCount() {
    const { redis } = this.uw;
    const rawCount = await redis.get('http-api:guests');
    if (typeof rawCount !== 'string' || !/^\d+$/.test(rawCount)) {
      return 0;
    }
    return parseInt(rawCount, 10);
  }

  /**
   * Update online guests count and broadcast an update if necessary.
   */
  recountGuests() { // eslint-disable-line class-methods-use-this
    // assigned in constructor()
  }

  async recountGuestsInternal() {
    const { redis } = this.uw;
    const guests = this.connections
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
