const routes = require('../routes/chat');

const defaultOptions = {
  maxLength: 300,
};

class Chat {
  constructor(uw, options = {}) {
    this.uw = uw;

    this.options = {
      ...defaultOptions,
      ...options,
    };

    this.chatID = Date.now();
  }

  async mute(user, duration, opts = {}) {
    await this.uw.redis.set(
      `mute:${user.id}`, opts.moderator.id,
      'PX', duration,
    );

    this.uw.publish('chat:mute', {
      moderatorID: opts.moderator.id,
      userID: user.id,
      duration,
    });
  }

  async unmute(user, opts = {}) {
    await this.uw.redis.del(`mute:${user.id}`);

    this.uw.publish('chat:unmute', {
      moderatorID: opts.moderator.id,
      userID: user.id,
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
      timestamp: Date.now(),
    });
  }

  delete(filter = {}, opts = {}) {
    const deletion = {
      filter: typeof filter === 'string' ? { id: filter } : filter,
    };

    if (opts.moderator) {
      deletion.moderatorID = opts.moderator.id;
    }

    this.uw.publish('chat:delete', deletion);
  }
}

async function chat(uw, opts = {}) {
  uw.chat = new Chat(uw, opts);
  uw.httpApi.use('/chat', routes());
}

module.exports = chat;
module.exports.Chat = Chat;
