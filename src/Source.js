/**
 * Data holder for things that source plugins may require.
 */
export class SourceContext {
  constructor(uw, source, user) {
    this.uw = uw;
    this.source = source;
    this.user = user;
  }
}

/**
 * Wrapper around playlist functions for use with import plugins. Intended to be
 * temporary until more data manipulation stuff is moved into core from api-v1.
 *
 * This is legacy, media sources should use the methods provided by the
 * `playlists` plugin instead.
 */
export class ImportContext extends SourceContext {
  /**
   * Create a playlist for the current user.
   *
   * @param {String} name Playlist name.
   * @param {Object|Array} itemOrItems Playlist items.
   * @return Playlist model.
   */
  async createPlaylist(name, itemOrItems) {
    const playlist = await this.uw.playlists.createPlaylist(this.user, { name });

    const rawItems = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    const items = this.source.addSourceType(rawItems);

    if (items.length > 0) {
      await playlist.addItems(items);
    }

    return playlist;
  }
}

/**
 * Wrapper around source plugins with some more convenient aliases.
 */
export default class Source {
  constructor(uw, sourceType, sourcePlugin) {
    this.uw = uw;
    this.type = sourceType;
    this.plugin = sourcePlugin;

    this.addSourceType = this.addSourceType.bind(this);
  }

  get apiVersion() {
    return this.plugin.api || 1;
  }

  /**
   * Add a default sourceType property to a list of media items.
   *
   * Media items can provide their own sourceType, too, so media sources can
   * aggregate items from different source types.
   */
  addSourceType(items) {
    return items.map((item) => ({
      sourceType: this.type,
      ...item,
    }));
  }

  /**
   * Find a single media item by ID.
   */
  getOne(user, id) {
    return this.get(user, [id])
      .then((items) => items[0]);
  }

  /**
   * Find several media items by ID.
   */
  async get(user, ids) {
    let items;
    if (this.apiVersion > 1) {
      const context = new SourceContext(this.uw, this, user);
      items = await this.plugin.get(context, ids);
    } else {
      items = await this.plugin.get(ids);
    }
    return this.addSourceType(items);
  }

  /**
   * Search this media source for items. Parameters can really be anything, but
   * will usually include a search string `query` and a page identifier `page`.
   */
  async search(user, query, page, ...args) {
    let results;
    if (this.apiVersion > 1) {
      const context = new SourceContext(this.uw, this, user);
      results = await this.plugin.search(context, query, page, ...args);
    } else {
      results = await this.plugin.search(query, page, ...args);
    }
    return this.addSourceType(results);
  }

  /**
   * Import *something* from this media source. Because media sources can
   * provide wildly different imports, üWave trusts clients to know what they're
   * doing.
   */
  'import'(user, ...args) {
    const importContext = new ImportContext(this.uw, this, user);
    return this.plugin.import(importContext, ...args);
  }
}
