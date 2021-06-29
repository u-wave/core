'use strict';

const routes = require('../routes/motd');

class MOTD {
  /**
   * @param {import('../Uwave')} uw
   */
  constructor(uw) {
    this.uw = uw;
  }

  /**
   * @returns {Promise<string | null>}
   */
  get() {
    return this.uw.redis.get('motd');
  }

  /**
   * @param {string|null} motd
   * @returns {Promise<void>}
   */
  async set(motd) {
    if (motd) {
      await this.uw.redis.set('motd', motd);
    } else {
      await this.uw.redis.del('motd');
    }
  }
}

/**
 * @param {import('../Uwave')} uw
 */
async function motdPlugin(uw) {
  uw.motd = new MOTD(uw);
  uw.httpApi.use('/motd', routes());
}

module.exports = motdPlugin;
module.exports.MOTD = MOTD;
