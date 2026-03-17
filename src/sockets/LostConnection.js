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
      this.#initQueued(lastEventID);
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
        } else {
          // TODO: can i populate `sessionData.cookie` here?
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
