const defaultOptions = {
  maxLength: 300
};

export class Chat {
  chatId = Date.now();

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

  async send(user, message) {
    if (await this.isMuted(user)) {
      return;
    }

    this.chatID += 1;

    this.uw.publish('chat:message', {
      id: `${user.id}-${this.chatID}`,
      userID: user.id,
      message: this.truncate(message),
      timestamp: Date.now()
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
