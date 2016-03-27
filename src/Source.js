/**
 * Wrapper around source plugins with some more convenient aliases.
 */
export default class Source {
  constructor(sourceType, sourcePlugin) {
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
}
