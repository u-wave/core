class MOTD {
  constructor(uw) {
    this.uw = uw;
  }

  async get() {
    return await this.uw.redis.get('motd');
  }

  async set(motd) {
    return await this.uw.redis.set('motd', motd);
  }
}

export default function motdPlugin() {
  return uw => {
    uw.motd = new MOTD(uw); // eslint-disable-line no-param-reassign
  };
}
