import SourceContext from './sources/SourceContext';
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
    return items.map(item => ({
      sourceType: this.type,
      ...item,
    }));
  }

  /**
   * Find a single media item by ID.
   */
  getOne(user, id) {
    return this.get(user, [id])
      .then(items => items[0]);
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
