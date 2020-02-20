const mongoose = require('mongoose');
const { PlaylistItemNotFoundError } = require('../errors');

/**
 * @template Element
 * @template Pagination
 * @typedef {import('../Page')<Element, Pagination>} Page
 */

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

function playlistModel() {
  return (uw) => {
    const schema = new Schema({
      name: {
        type: String,
        min: 0,
        max: 128,
        required: true,
        set: (name) => name.normalize('NFKC'),
      },
      description: { type: String, min: 0, max: 512 },
      author: {
        type: Types.ObjectId, ref: 'User', required: true, index: true,
      },
      shared: { type: Boolean, default: false },
      nsfw: { type: Boolean, default: false },
      media: [{ type: Types.ObjectId, ref: 'PlaylistItem', index: true }],
    }, {
      collection: 'playlists',
      timestamps: true,
      toJSON: { getters: true },
      minimize: false,
    });

    schema.loadClass(class Playlist {
      /** @type {number} */
      get size() {
        return this.media.length;
      }

      getItem(id) {
        if (!this.media.some((item) => `${item}` === `${id}`)) {
          throw new PlaylistItemNotFoundError({ id });
        }
        return uw.playlists.getPlaylistItem(id);
      }

      /** @return {Promise<unknown>} */
      getItemAt(index) {
        return uw.playlists.getPlaylistItem(this.media[index]);
      }

      /** @return {Promise<Page<unknown, unknown>>} */
      getItems(filter, page) {
        return uw.playlists.getPlaylistItems(this, filter, page);
      }

      /** @return {Promise<unknown>} */
      addItems(items, opts = {}) {
        return uw.playlists.addPlaylistItems(this, items, opts);
      }

      /** @return {Promise<unknown>} */
      async updateItem(id, patch = {}) {
        const item = await this.getItem(id);
        return uw.playlists.updatePlaylistItem(item, patch);
      }

      /** @return {Promise<unknown>} */
      shuffle() {
        return uw.playlists.shufflePlaylist(this);
      }

      /** @return {Promise<unknown>} */
      moveItems(ids, afterID) {
        return uw.playlists.movePlaylistItems(this, ids, afterID);
      }

      /** @return {Promise<unknown>} */
      removeItem(id) {
        return this.removeItems([id]);
      }

      /** @return {Promise<unknown>} */
      removeItems(ids) {
        return uw.playlists.removePlaylistItems(this, ids);
      }
    });

    uw.mongo.model('Playlist', schema);
  };
}

module.exports = playlistModel;
