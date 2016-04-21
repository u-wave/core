import ImportContext from './sources/ImportContext';

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

  /**
   * Add a default sourceType property to a list of media items.
   *
   * Media items can provide their own sourceType, too, so media sources can
   * aggregate items from different source types.
   */
  addSourceType(items) {
    return items.map(item => ({
      sourceType: this.type,
      ...item
    }));
  }

  /**
   * Find a single media item by ID.
   */
  getOne(id) {
    return this.get([id])
      .then(items => items[0]);
  }

  /**
   * Find several media items by ID.
   */
  get(ids) {
    return this.plugin.get(ids)
      .then(this.addSourceType);
  }

  /**
   * Search this media source for items. Parameters can really be anything, but
   * will usually include a search string `query` and a page identifier `page`.
   */
  search(query, page, ...args) {
    return this.plugin.search(query, page, ...args)
      .then(this.addSourceType);
  }

  /**
   * Import *something* from this media source. Because media sources can
   * provide wildly different imports, üWave trusts clients to know what they're
   * doing.
   */
  async 'import'(user, ...args) {
    const importContext = new ImportContext(this.uw, this, user);
    return await this.plugin.import(importContext, ...args);
  }
}
