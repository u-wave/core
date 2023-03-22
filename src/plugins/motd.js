import routes from '../routes/motd.js';

class MOTD {
  #uw;

  /**
   * @param {import('../Uwave').default} uw
   */
  constructor(uw) {
    this.#uw = uw;
  }

  /**
   * @returns {Promise<string | null>}
   */
  get() {
    return this.#uw.redis.get('motd');
  }

  /**
   * @param {string|null} motd
   * @returns {Promise<void>}
   */
  async set(motd) {
    if (motd) {
      await this.#uw.redis.set('motd', motd);
    } else {
      await this.#uw.redis.del('motd');
    }
  }
}

/**
 * @param {import('../Uwave').default} uw
 */
async function motdPlugin(uw) {
  uw.motd = new MOTD(uw);
  uw.httpApi.use('/motd', routes());
}

export default motdPlugin;
export { MOTD };
