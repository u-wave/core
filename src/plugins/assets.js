const path = require('path');
const fs = require('fs').promises;
const serveStatic = require('serve-static');

class FSAssets {
  /**
   * @typedef {object} FSAssetsOptions
   * @prop {string} [publicPath]
   * @prop {string} basedir
   *
   * @param {FSAssetsOptions} options
   */
  constructor(options) {
    this.options = {
      publicPath: '/assets/',
      ...options,
    };

    if (!this.options.basedir) {
      throw new TypeError('u-wave: fs-assets: missing basedir');
    }
  }

  /**
   * @type {string}
   * @private
   */
  get basedir() {
    return this.options.basedir;
  }

  /**
   * @param {string} key
   * @private
   */
  path(key) {
    return path.resolve(this.basedir, key);
  }

  /**
   * @param {string} key
   */
  publicPath(key) {
    const publicPath = this.options.publicPath.replace(/\/$/, '');
    return `${publicPath}/${key}`;
  }

  /**
   * @param {string} key
   * @param {Buffer|ArrayBuffer|string} content
   * @returns {Promise<string>} The actual key used.
   */
  async store(key, content) {
    const fullPath = this.path(key);
    // TODO check if fullPath is "below" basedir
    await fs.writeFile(fullPath, content);
    return path.relative(this.basedir, fullPath);
  }

  /**
   * @param {string} key
   * @returns {Promise<Buffer>}
   */
  async get(key) {
    const fullPath = this.path(key);
    return fs.readFile(fullPath);
  }

  middleware() {
    return serveStatic(this.basedir, {
      index: false,
      redirect: false,
    });
  }
}

/**
 * @param {import('../Uwave').Boot} uw
 * @param {FSAssetsOptions} options
 */
async function assetsPlugin(uw, options) {
  uw.assets = new FSAssets(options);
}

module.exports = assetsPlugin;
module.exports.Assets = FSAssets;
