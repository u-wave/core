'use strict';

const routes = require('../routes/motd');

class MOTD {
  /**
   * @param {import('../Uwave')} uw
   */
  constructor(uw) {
    this.uw = uw;
  }

  get() {
    return this.uw.redis.get('motd');
  }

  /**
   * @param {string} motd
   * @returns {Promise<void>}
   */
  async set(motd) {
    await this.uw.redis.set('motd', motd);
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
