'use strict';

const { randomUUID } = require('crypto');
const { ChatMutedError, TooManyTagsError } = require('../errors');
const routes = require('../routes/chat');

/**
 * @typedef {import('../models').User} User
 *
 * @typedef {object} ChatOptions
 * @prop {number} maxLength
 *
 * @typedef {object} ChatMessage
 * @prop {string} message
 * @prop {Partial<import('../types').ChatTags>} [tags]
 */

/** @type {ChatOptions} */
const defaultOptions = {
  maxLength: 300,
};

class Chat {
  #uw;

  /** @type {ChatOptions} */
  #options;

  /**
   * @param {import('../Uwave')} uw
   * @param {Partial<ChatOptions>} [options]
   */
  constructor(uw, options = {}) {
    this.#uw = uw;

    this.#options = {
      ...defaultOptions,
      ...options,
    };
  }

  /**
   * @param {User} user
   * @param {number} duration
   * @param {{ moderator: User }} options
   */
  async mute(user, duration, options) {
    await this.#uw.redis.set(
      `mute:${user.id}`,
      options.moderator.id,
      'PX',
      duration,
    );

    this.#uw.publish('chat:mute', {
      moderatorID: options.moderator.id,
      userID: user.id,
      duration,
    });
  }

  /**
   * @param {User} user
   * @param {{ moderator: User }} options
   */
  async unmute(user, options) {
    await this.#uw.redis.del(`mute:${user.id}`);

    this.#uw.publish('chat:unmute', {
      moderatorID: options.moderator.id,
      userID: user.id,
    });
  }

  /**
   * @param {User} user
   *
   * @private
   */
  isMuted(user) {
    return this.#uw.redis.exists(`mute:${user.id}`);
  }

  /**
   * @param {string} message
   *
   * @private
   */
  truncate(message) {
    return message.slice(0, this.#options.maxLength);
  }

  /**
   * @param {User} user
   * @param {ChatMessage} data
   */
  async send(user, { message, tags }) {
    const { acl } = this.#uw;

    const maxLength = 2048;
    if (tags && JSON.stringify(tags).length > maxLength) {
      throw new TooManyTagsError({ maxLength });
    }

    if (await this.isMuted(user)) {
      throw new ChatMutedError();
    }

    const permissions = tags ? await acl.getAllPermissions(user) : [];
    const globalTags = new Set(['id', 'replyTo']);
    const filteredTags = tags
      ? Object.fromEntries(
        Object.entries(tags)
          .filter(([name]) => globalTags.has(name) || permissions.includes(name)),
      )
      : {};

    const id = randomUUID();
    const timestamp = Date.now();
    const truncatedMessage = this.truncate(message);
    this.#uw.publish('chat:message', {
      id,
      userID: user.id,
      message: truncatedMessage,
      timestamp,
      tags: filteredTags,
    });

    return {
      _id: id,
      message: truncatedMessage,
      timestamp,
      tags: filteredTags,
    };
  }

  /**
   * @param {{ id: string } | { userID: string } | {}} filter
   * @param {{ moderator: User }} options
   */
  delete(filter, options) {
    const deletion = {
      filter: typeof filter === 'string' ? { id: filter } : filter,
      moderatorID: options.moderator.id,
    };

    this.#uw.publish('chat:delete', deletion);
  }
}

/**
 * @param {import('../Uwave')} uw
 * @param {Partial<ChatOptions>} [options]
 */
async function chat(uw, options = {}) {
  uw.chat = new Chat(uw, options);
  uw.httpApi.use('/chat', routes());
}

module.exports = chat;
module.exports.Chat = Chat;
