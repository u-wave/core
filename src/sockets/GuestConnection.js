import Emittery from 'emittery';
import { ulid } from 'ulid';
import Ultron from 'ultron';
import WebSocket from 'ws';

const PING_TIMEOUT = 5_000;
const DEAD_TIMEOUT = 30_000;

/**
 * @augments {Emittery<{
 *  close: undefined,
 *  authenticate: { user: import('../schema.js').User, sessionID: string, lastEventID: string | null }
 * }>}
 */
class GuestConnection extends Emittery {
  #events;

  #logger;

  #lastMessage = Date.now();

  /**
   * @param {import('../Uwave.js').default} uw
   * @param {import('ws').WebSocket} socket
   * @param {{ authRegistry: import('../AuthRegistry.js').default }} options
   */
  constructor(uw, socket, options) {
    super();
    this.uw = uw;
    this.socket = socket;
    this.options = options;
    this.#logger = uw.logger.child({ ns: 'uwave:sockets', connectionType: 'GuestConnection', userId: null });

    this.#events = new Ultron(socket);

    this.#events.on('close', () => {
      this.emit('close');
    });

    this.#events.on('message', /** @param {string|Buffer} token */ (token) => {
      this.attemptAuth(token.toString()).then(() => {
        this.send(ulid(), 'authenticated');
      }).catch((error) => {
        this.send(ulid(), 'error', error.message);
      });
    });

    this.#events.on('pong', () => {
      this.#lastMessage = Date.now();
    });
  }

  /**
   * @param {string} token
   * @private
   */
  async attemptAuth(token) {
    // TODO: support a Last-Event-ID style value provided by the client
    const { bans, users } = this.uw;
    const { authRegistry } = this.options;

    const { userID, sessionID } = await authRegistry.getTokenUser(token);
    if (!sessionID || typeof sessionID !== 'string') {
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

    await this.emit('authenticate', { user: userModel, sessionID, lastEventID: null });
  }

  /**
   * @param {string} sessionID
   */
  isReconnect(sessionID) {
    return this.uw.redis.exists(`http-api:disconnected:${sessionID}`);
  }

  /**
   * @param {string} id
   * @param {string} command
   * @param {import('type-fest').JsonValue} [data]
   */
  send(id, command, data) {
    this.socket.send(JSON.stringify({ id, command, data }));
  }

  #timeSinceLastMessage() {
    return Date.now() - this.#lastMessage;
  }

  ping() {
    if (this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (this.#timeSinceLastMessage() > DEAD_TIMEOUT) {
      this.socket.terminate();
      return;
    }
    if (this.#timeSinceLastMessage() > PING_TIMEOUT) {
      this.socket.ping();
    }
  }

  close() {
    this.#logger.info('close');
    this.socket.close();
  }

  removed() {
    this.#events.remove();
  }

  toString() {
    return 'Guest';
  }
}

export default GuestConnection;
