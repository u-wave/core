import Emittery from 'emittery';

/**
 * @augments {Emittery<{ close: undefined }>}
 */
class LostConnection extends Emittery {
  #logger;

  #expiresAt;

  #uw;

  /**
   * @param {import('../Uwave.js').default} uw
   * @param {import('../schema.js').User} user
   * @param {string} sessionID
   * @param {string|null} lastEventID
   */
  constructor(uw, user, sessionID, lastEventID, timeout = 30) {
    super();
    this.#uw = uw;
    this.user = user;
    this.sessionID = sessionID;
    this.#expiresAt = Date.now() + timeout * 1_000;
    this.#logger = uw.logger.child({
      ns: 'uwave:sockets', connectionType: 'LostConnection', userID: this.user.id, sessionID,
    });

    if (lastEventID != null) {
      this.#initQueued(lastEventID, timeout);
    }
  }

  get #key() {
    return `http-api:disconnected:${this.sessionID}`;
  }

  /**
   * @param {string} lastEventID
   * @param {number} seconds
   */
  #initQueued(lastEventID, seconds) {
    // We expire the keys after timeout*10, because a server restart near the
    // end of the timeout might mean that someone fails to reconnect. This way
    // we can ensure that everyone still gets the full `timeout` duration to
    // reconnect after a server restart, while also not filling up Redis with
    // session IDs that left and will never return.
    this.#uw.redis.set(this.#key, lastEventID, 'EX', seconds * 10);
  }

  /**
   * @param {string} id
   * @param {string} command
   * @param {import('type-fest').JsonValue} data
   */
  send(id, command, data) {
    this.#logger.info({ id, command, data }, 'queue command');
  }

  ping() {
    if (Date.now() > this.#expiresAt) {
      this.close();
    }
  }

  close() {
    this.#logger.info('close');
    this.emit('close');
  }

  removed() {
    // Nothing to do
  }

  toString() {
    return `Lost { user: ${this.user.id} ${this.user.username} }`;
  }
}

export default LostConnection;
