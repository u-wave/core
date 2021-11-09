'use strict';

const EventEmitter = require('events');
const createDebug = require('debug');

const debug = createDebug('uwave:api:sockets:lost');

class LostConnection extends EventEmitter {
  /**
   * @param {import('../Uwave')} uw
   * @param {import('../models').User} user
   */
  constructor(uw, user, timeout = 30) {
    super();
    this.uw = uw;
    this.user = user;
    this.timeout = timeout;

    this.initQueued();
    this.setTimeout(timeout);
  }

  /**
   * @private
   */
  get key() {
    return `http-api:disconnected:${this.user.id}`;
  }

  /**
   * @private
   */
  get messagesKey() {
    return `http-api:disconnected:${this.user.id}:messages`;
  }

  /**
   * @private
   */
  initQueued() {
    // We expire the keys after timeout*10, because a server restart near the
    // end of the timeout might mean that someone fails to reconnect. This way
    // we can ensure that everyone still gets the full `timeout` duration to
    // reconnect after a server restart, while also not filling up Redis with
    // messages to users who left and will never return.
    this.uw.redis.multi()
      .set(this.key, 'true', 'EX', this.timeout * 10)
      .ltrim(this.messagesKey, 0, 0)
      .expire(this.messagesKey, this.timeout * 10)
      .exec();
  }

  /**
   * @param {number} timeout
   * @private
   */
  setTimeout(timeout) {
    this.removeTimer = setTimeout(() => {
      this.close();
      this.uw.redis.del(this.key, this.messagesKey);
    }, timeout * 1000);
  }

  /**
   * @param {string} command
   * @param {import('type-fest').JsonValue} data
   */
  send(command, data) {
    debug('queueing', command, data);

    this.uw.redis.rpush(
      this.messagesKey,
      JSON.stringify({ command, data }),
    );
  }

  close() {
    debug('close', this.toString());
    this.emit('close');
  }

  removed() {
    if (this.removeTimer) {
      clearTimeout(this.removeTimer);
    }
  }

  toString() {
    return `Lost { user: ${this.user.id} ${this.user.username} }`;
  }
}

module.exports = LostConnection;
