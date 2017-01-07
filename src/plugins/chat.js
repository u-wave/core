import Promise from 'bluebird';
import isEmpty from 'is-empty-object';

/**
 * Filter a message tags object to remove tags that cannot be used by the given
 * user.
 */
function filterAllowedTags(user, tags) {
  if (isEmpty(tags)) {
    return {};
  }

  const allowedTagNames = Promise.all(Object.keys(tags))
    .filter(tagName => user.can(`chat.tags.${tagName}`));

  return allowedTagNames.reduce((obj, tagName) => {
    // eslint-disable-next-line no-param-reassign
    obj[tagName] = tags[tagName];
    return obj;
  });
}

const defaultOptions = {
  maxLength: 300
};

export class Chat {
  chatID = Date.now();

  constructor(uw, options = {}) {
    this.uw = uw;

    this.options = {
      ...defaultOptions,
      ...options
    };
  }

  async mute(user, duration, opts = {}) {
    await this.uw.redis.set(
      `mute:${user.id}`, opts.moderator.id,
      'PX', duration
    );

    this.uw.publish('chat:mute', {
      moderatorID: opts.moderator.id,
      userID: user.id,
      duration
    });
  }

  async unmute(user, opts = {}) {
    await this.uw.redis.del(`mute:${user.id}`);

    this.uw.publish('chat:unmute', {
      moderatorID: opts.moderator.id,
      userID: user.id
    });
  }

  isMuted(user) {
    return this.uw.redis.exists(`mute:${user.id}`);
  }

  truncate(message) {
    return message.slice(0, this.options.maxLength);
  }

  /**
   * Send a chat message.
   */
  async send(user, message, tags = {}) {
    if (await this.isMuted(user)) {
      return;
    }

    const allowedTags = await filterAllowedTags(user, tags);

    this.chatID += 1;

    this.uw.publish('chat:message', {
      id: `${user.id}-${this.chatID}`,
      userID: user.id,
      message: this.truncate(message),
      timestamp: Date.now(),
      tags: allowedTags
    });
  }

  delete(filter = {}, opts = {}) {
    const deletion = {
      filter: typeof filter === 'string' ? { id: filter } : filter
    };

    if (opts.moderator) {
      deletion.moderatorID = opts.moderator.id;
    }

    this.uw.publish('chat:delete', deletion);
  }
}

export default function chat(opts = {}) {
  return (uw) => {
    uw.chat = new Chat(uw, opts); // eslint-disable-line no-param-reassign
  };
}
