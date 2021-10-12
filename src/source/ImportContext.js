'use strict';

const SourceContext = require('./SourceContext');

/** @typedef {import('../models').Playlist} Playlist */
/** @typedef {import('../plugins/playlists').PlaylistItemDesc} PlaylistItemDesc */

/**
 * Wrapper around playlist functions for use with import plugins. Intended to be
 * temporary until more data manipulation stuff is moved into core from api-v1.
 *
 * This is legacy, media sources should use the methods provided by the
 * `playlists` plugin instead.
 */
class ImportContext extends SourceContext {
  /**
   * Create a playlist for the current user.
   *
   * @param {string} name Playlist name.
   * @param {Omit<PlaylistItemDesc, 'sourceType'>[]} itemOrItems Playlist items.
   * @returns {Promise<Playlist>} Playlist model.
   */
  async createPlaylist(name, itemOrItems) {
    const playlist = await this.uw.playlists.createPlaylist(this.user, { name });

    const rawItems = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    const items = this.source.addSourceType(rawItems);

    if (items.length > 0) {
      await this.uw.playlists.addPlaylistItems(playlist, items);
    }

    return playlist;
  }
}

module.exports = ImportContext;
