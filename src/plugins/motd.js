const routes = require('../routes/motd');

class MOTD {
  constructor(uw) {
    this.uw = uw;
  }

  get() {
    return this.uw.redis.get('motd');
  }

  set(motd) {
    return this.uw.redis.set('motd', motd);
  }
}

function motdPlugin() {
  return (uw) => {
    uw.motd = new MOTD(uw);
    uw.httpApi.use('/motd', routes());
  };
}

module.exports = motdPlugin;
