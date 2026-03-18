import Emittery from 'emittery';

/**
 * @augments {Emittery<{ close: undefined }>}
 */
class LostConnection extends Emittery {
  #logger;

  #expiresAt;

  /** @type {import('express-session').Store} */
  #sessionStore;

  /**
   * @param {import('../Uwave.js').default} uw
   * @param {import('express-session').Store} store
   * @param {import('../schema.js').User} user
   * @param {string} sessionID
   * @param {string|null} lastEventID
   */
  constructor(uw, store, user, sessionID, lastEventID, timeout = 30) {
    super();
    this.#sessionStore = store;
    this.user = user;
    this.sessionID = sessionID;
    this.#expiresAt = Date.now() + timeout * 1_000;
    this.#logger = uw.logger.child({
      ns: 'uwave:sockets',
      connectionType: 'LostConnection',
      userID: this.user.id,
      sessionID,
    });

    if (lastEventID != null) {
      this.#initQueued(lastEventID).catch((err) => {
        this.#logger.warn({ err }, 'failed to save Last-Event-ID to session');
      });
    }
  }

  /**
   * @param {string} lastEventID
   */
  #initQueued(lastEventID) {
    return new Promise((resolve, reject) => {
      this.#sessionStore.load(this.sessionID, (err, sessionData) => {
        if (err != null) {
          reject(err);
        } else if (sessionData == null) {
          // If we don't actually have a session we don't bother, this should only happen if
          // a WebSocket connection was set up and authenticated without going thru a login flow
          // or if only JWTs and no cookies were used; in those cases, clients should track last
          // event ID and submit it when reconnecting
          resolve(undefined);
        } else {
          this.#sessionStore.set(this.sessionID, { ...sessionData, lastEventID }, (err) => {
            if (err != null) {
              reject(err);
            } else {
              resolve(undefined);
            }
          });
        }
      });
    });
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
