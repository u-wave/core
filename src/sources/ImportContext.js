/**
 * Wrapper around playlist functions for use with import plugins. Intended to be
 * temporary until more data manipulation stuff is moved into core from api-v1.
 *
 * This is legacy, media sources should use the methods provided by the
 * `playlists` plugin instead.
 */
export default class ImportContext {
  constructor(uw, source, user) {
    this.uw = uw;
    this.source = source;
    this.user = user;
  }

  /**
   * Create a playlist for the current user.
   *
   * @param {String} name Playlist name.
   * @param {Object|Array} itemOrItems Playlist items.
   * @return Playlist model.
   */
  async createPlaylist(name, itemOrItems) {
    const playlist = await this.uw.playlists.createPlaylist(this.user, { name });

    const rawItems = this.source.addSourceType(
      Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems]
    );

    if (rawItems.length > 0) {
      await playlist.addItems(rawItems);
    }

    return playlist;
  }
}
