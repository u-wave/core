import createDebug from 'debug';

const debug = createDebug('uwave:core:sessions');

const CONNECT_SCRIPT = `
  local currentCount = redis.call("incr", KEYS[1])
  if currentCount == 1 then
    redis.call("sadd", "sessions", ARGV[1])
  end
  return currentCount
`;
const DISCONNECT_SCRIPT = `
  local currentCount = redis.call("decr", KEYS[1])
  if currentCount == 0 then
    redis.call("srem", "sessions", ARGV[1])
    redis.call("del", KEYS[1])
  end
  return currentCount
`;

class Sessions {
  constructor(uw) {
    this.uw = uw;
  }

  async connect(user) {
    debug('connect', user.id);
    const count = await this.uw.redis.eval(CONNECT_SCRIPT, 1, `sessionCounts:${user.id}`, user.id);

    user.seen().catch((err) => {
      debug(err);
    });

    if (count > 1) return;

    debug('is new connection', user.id);
    this.uw.publish('user:connect', { userID: user.id });
  }

  async disconnect(user) {
    debug('disconnect', user.id);
    const count = await this.uw.redis.eval(DISCONNECT_SCRIPT, 1, `sessionCounts:${user.id}`, user.id);
    if (count > 0) return;

    debug('is last connection', user.id);

    const dj = await this.uw.booth.getCurrentDJ();
    if (dj && dj.id === user.id) {
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
