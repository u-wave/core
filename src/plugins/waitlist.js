/**
 *
 */
export class CyclingQueue {
  list = [];

  constructor(uw) {
    this.uw = uw;
  }

  publishUpdate() {
    this.uw.publish('waitlist:update', this.list);
  }

  async peek() {
    const { users } = this.uw;
    const first = await this.uw.redis.lindex('waitlist', 0);
    const id = first || await this.uw.redis.get('waitlist:current');
    if (!id) {
      return null;
    }
    return await users.getUser(id);
  }

  async cycle() {
    const previous = this.list.shift();
    if (previous) {
      this.list.push(previous);
    }
    this.publishUpdate();
  }

  async add(user) {
    const { booth, users } = this.uw;
    this.list.push(await users.getUser(user));
    const entry = await booth.getCurrentEntry();
    if (!entry) {
      await booth.advance();
    } else {
      this.publishUpdate();
    }
  }

  async remove(user) {
    const id = typeof user === 'object' ? user.id : user;
    this.list = this.list.filter(waiting => waiting.id !== id);
    this.publishUpdate();
  }

  async clear(opts = {}) {
    await this.uw.redis.del('waitlist');
    this.uw.publish('waitlist:clear', opts);
  }

  async current() {
    const { redis, users } = this.uw;
    const id = await redis.get('waitlist:current');
    return id ? await users.getUser(id) : null;
  }

  async users() {
    const { redis, users } = this.uw;
    const waitlist = await redis.lrange('waitlist', 0, -1)
    return await users.getUsers(waitlist);
  }
}

export default function waitlist() {
  return uw => {
    uw.waitlist = new CyclingQueue(uw); // eslint-disable-line no-param-reassign
  };
}
