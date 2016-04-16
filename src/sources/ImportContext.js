import groupBy from 'lodash.groupby';

/**
 * Wrapper around playlist functions for use with import plugins. Intended to be
 * temporary until more data manipulation stuff is moved into core from api-v1.
 *
 * TODO Proooobably obsolete this after these functions are moved to their
 * appropriate plugins. Source plugins will then have to pass the current User
 * manually, but it'd keep the API surface quite a bit smaller.
 */
export default class ImportContext {
  constructor(uw, source, user) {
    this.uw = uw;
    this.source = source;
    this.user = user;
  }

  /**
   * Import playlist items, creating Media models if they don't yet exist.
   *
   * TODO Move to a "playlist(s)" plugin.
   *
   * @param {Array} items Plain playlist item objects.
   * @return PlaylistItem models.
   */
  async createPlaylistItems(items) {
    const Media = this.uw.model('Media');
    const PlaylistItem = this.uw.model('PlaylistItem');

    const itemsBySourceType = groupBy(items, 'sourceType');
    const playlistItems = [];
    for (const sourceType in itemsBySourceType) {
      if (!itemsBySourceType.hasOwnProperty(sourceType)) {
        continue;
      }

      const sourceItems = itemsBySourceType[sourceType];
      const knownMedias = await Media.find({
        sourceType,
        sourceID: { $in: sourceItems.map(item => item.sourceID) }
      }).select({ sourceID: 1 });

      const unknownMediaIDs = [];
      sourceItems.forEach(item => {
        if (!knownMedias.some(media => media.sourceID === item.sourceID)) {
          unknownMediaIDs.push(item.sourceID);
        }
      });

      const unknownMedias = await this.source.get(unknownMediaIDs);
      const allMedias = knownMedias.concat(await Media.create(unknownMedias));
      const itemsWithMedia = sourceItems.map(item => ({
        ...item,
        media: allMedias.find(media => media.sourceID === item.sourceID)
      }));
      playlistItems.push(...itemsWithMedia);
    }

    return await PlaylistItem.create(playlistItems);
  }

  /**
   * Create a playlist for the current user.
   *
   * TODO Move to a "playlist(s)" plugin and call that.
   *
   * @param {String} name Playlist name.
   * @param {Object|Array} itemOrItems Playlist items.
   * @return Playlist model.
   */
  async createPlaylist(name, itemOrItems) {
    const Playlist = this.uw.model('Playlist');

    const playlist = new Playlist({
      name,
      author: this.user,
      media: []
    });

    await playlist.validate();

    const rawItems = this.source.addSourceType(
      Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems]
    );

    if (rawItems.length > 0) {
      const playlistItems = await this.createPlaylistItems(rawItems);
      playlist.media = playlistItems;
    } else {
      playlist.media = [];
    }

    return await playlist.save();
  }
}
