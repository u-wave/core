import createDebug from 'debug';

const debug = createDebug('uwave:core:sessions');

class Sessions {
  constructor(uw) {
    this.uw = uw;
  }

  async connect(user) {
    debug('connect', user.id);
    const count = await this.uw.redis.incr(`sessionCounts:${user.id}`);
    if (count > 1) return;

    debug('is new connection', user.id);
    await this.uw.redis.sadd('sessions', user.id);
    this.uw.publish('user:connect', { userID: user.id });
  }

  async disconnect(user) {
    debug('disconnect', user.id);
    const count = await this.uw.redis.decr(`sessionCounts:${user.id}`);
    if (count > 0) return;

    debug('is last connection', user.id);
    await this.uw.redis.srem('sessions', user.id);
    await this.uw.redis.del(`sessionCounts:${user.id}`);

    const dj = await this.uw.booth.getCurrentDJ();
    if (dj.id === user.id) {
      debug('disconnecting from booth', user.id);
      await this.uw.advance({ remove: true });
    } else {
      const waitlist = await this.uw.booth.getWaitlist();
      if (waitlist.includes(user.id)) {
        debug('disconnecting from waitlist', user.id);
        await this.uw.redis.lrem('waitlist', 0, user.id);
        const nextWaitlist = waitlist.filter(id => id !== user.id);
        this.uw.publish('waitlist:update', nextWaitlist);
      }
    }

    this.uw.publish('user:disconnect', { userID: user.id });
  }

  isOnline(user) {
    return this.uw.redis.sismember('sessions', user.id);
  }

  async getOnlineUsers() {
    const userIDs = await this.uw.redis.smembers('sessions');
    return userIDs;
  }
}

export default function sessions() {
  return (uw) => {
    uw.sessions = new Sessions(uw); // eslint-disable-line no-param-reassign
  };
}
