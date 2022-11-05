'use strict';

const { finished, pipeline } = require('stream');
const mime = require('mime');
const BlobStore = require('fs-blob-store');

class FSAssets {
  #uw;

  #store;

  /**
   * @typedef {object} FSAssetsOptions
   * @prop {string} [publicPath]
   * @prop {string} basedir
   *
   * @param {import('../Uwave')} uw
   * @param {FSAssetsOptions} options
   */
  constructor(uw, options) {
    this.#uw = uw;
    this.options = {
      publicPath: '/assets/',
      ...options,
    };

    if (!this.options.basedir) {
      throw new TypeError('u-wave: fs-assets: missing basedir');
    }

    this.#store = new BlobStore(this.options.basedir);
  }

  /**
   * @param {string} key
   */
  publicPath(key) {
    const publicPath = this.options.publicPath.replace(/\/$/, '');
    return `${publicPath}/${key}`;
  }

  /**
   * @typedef {object} StoreOptions
   * @prop {string} category
   * @prop {import('mongodb').ObjectId} userID
   *
   * @param {string} name
   * @param {Buffer|string} content
   * @param {StoreOptions} options
   * @returns {Promise<string>} The actual key used.
   */
  async store(name, content, { category, userID }) {
    const { Asset } = this.#uw.models;

    const key = `${category}/${userID}/${name}`;
    const path = await new Promise((resolve, reject) => {
      /** @type {import('stream').Writable} */
      const ws = this.#store.createWriteStream({ key }, (err, meta) => {
        if (err) {
          reject(err);
        } else {
          resolve(meta.key);
        }
      });
      ws.end(content);
    });

    try {
      await Asset.create({
        name,
        path,
        category,
        user: userID,
      });
    } catch (error) {
      this.#store.remove({ key: path }, () => {
        // ignore
      });
      throw error;
    }

    return path;
  }

  /**
   * @param {string} key
   * @returns {Promise<Buffer>}
   */
  get(key) {
    return new Promise((resolve, reject) => {
      /** @type {import('stream').Readable} */
      const rs = this.#store.createReadStream({ key });

      /** @type {Buffer[]} */
      const chunks = [];
      finished(rs, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(Buffer.concat(chunks));
        }
      });

      rs.on('data', (chunk) => {
        chunks.push(chunk);
      });
    });
  }

  /**
   * @returns {import('express').RequestHandler}
   */
  middleware() {
    // Note this is VERY inefficient!
    // Perhaps it will be improved in the future : )
    return (req, res, next) => {
      const key = req.url;
      const type = mime.getType(key);
      if (type) {
        res.setHeader('content-type', type);
      }
      pipeline(this.#store.createReadStream({ key }), res, next);
    };
  }
}

/**
 * @param {import('../Uwave').Boot} uw
 * @param {FSAssetsOptions} options
 */
async function assetsPlugin(uw, options) {
  uw.assets = new FSAssets(uw, options);
}

module.exports = assetsPlugin;
module.exports.Assets = FSAssets;
