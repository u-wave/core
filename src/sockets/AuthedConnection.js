import Emittery from 'emittery';
import Ultron from 'ultron';
import WebSocket from 'ws';
import sjson from 'secure-json-parse';
import { ulid } from 'ulid';
import { fromJson, json } from '../utils/sqlite.js';

const PING_TIMEOUT = 5_000;
const DEAD_TIMEOUT = 30_000;

/**
 * @augments {Emittery<{
 *   command: { command: string, data: import('type-fest').JsonValue },
 *   close: { banned: boolean, lastEventID: string | null },
 * }>}
 */
class AuthedConnection extends Emittery {
  #events;

  #logger;

  #lastMessage = Date.now();

  // Ideally, the client should actually be responsible for this,
  // because the server only knows if something was *sent*, not if it was received.
  /** @type {string|null} */
  #lastEventID = null;

  banned = false;

  /**
   * @param {import('../Uwave.js').default} uw
   * @param {import('ws').WebSocket} socket
   * @param {import('../schema.js').User} user
   * @param {string} sessionID
   * @param {string|null} lastEventID
   */
  constructor(uw, socket, user, sessionID, lastEventID) {
    super();
    this.uw = uw;
    this.socket = socket;
    this.#events = new Ultron(this.socket);
    this.user = user;
    this.sessionID = sessionID;
    this.#logger = uw.logger.child({
      ns: 'uwave:sockets', connectionType: 'AuthedConnection', userId: this.user.id, sessionID,
    });

    this.#events.on('close', () => {
      this.emit('close', {
        banned: this.banned,
        lastEventID: this.#lastEventID,
      });
    });
    this.#events.on('message', (raw) => {
      this.#onMessage(raw);
    });
    this.#events.on('pong', () => {
      this.#onPong();
    });

    this.#sendWaiting(lastEventID).catch((err) => {
      this.#logger.error({ err }, 'failed to send waiting messages on reconnect');
    });
  }

  /**
   * @private
   */
  get key() {
    return `http-api:disconnected:${this.sessionID}`;
  }

  /** @param {string|null} clientLastEventID */
  async #sendWaiting(clientLastEventID) {
    // Legacy clients may not send a last event ID.
    const lastEventID = clientLastEventID ?? await this.uw.redis?.get(this.key);
    if (!lastEventID) {
      return;
    }

    const messages = await this.uw.db.selectFrom('socketMessageQueue')
      .select([
        'id',
        'command',
        (eb) => json(eb.ref('data')).as('data'),
      ])
      .where('id', '>', lastEventID)
      .where((eb) => eb.or([
        eb('targetUserID', 'is', null),
        eb('targetUserID', '=', this.user.id),
      ]))
      .execute();

    this.#logger.info({ count: messages.length }, 'queued messages');
    messages.forEach((message) => {
      this.send(message.id, message.command, fromJson(message.data));
    });
  }

  /**
   * @param {string|Buffer} raw
   */
  #onMessage(raw) {
    this.#lastMessage = Date.now();
    const { command, data } = sjson.safeParse(raw) ?? {};
    if (command) {
      this.emit('command', { command, data });
    }
  }

  #onPong() {
    this.#lastMessage = Date.now();
  }

  /**
   * @param {string} id
   * @param {string} command
   * @param {import('type-fest').JsonValue} data
   */
  send(id, command, data) {
    this.socket.send(JSON.stringify({ id, command, data }));
    this.#lastMessage = Date.now();
    this.#lastEventID = id;
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

  ban() {
    this.#logger.info('ban');
    this.banned = true;
    this.send(ulid(), 'error', 'You have been banned');
    this.socket.close(4001, 'ban');
  }

  close() {
    this.#logger.info('close');
    this.socket.close();
  }

  removed() {
    this.#events.remove();
  }

  toString() {
    return `Authed { user: ${this.user.id} ${this.user.username} }`;
  }
}

export default AuthedConnection;
