'use strict';

const has = require('has');
const { SourceNoImportError } = require('../errors');
const SourceContext = require('./SourceContext');
const ImportContext = require('./ImportContext');
const Page = require('../Page');

/** @typedef {import('../Uwave')} Uwave */
/** @typedef {import('../models').User} User */
/** @typedef {import('../models').Playlist} Playlist */
/** @typedef {import('../plugins/playlists').PlaylistItemDesc} PlaylistItemDesc */
/** @typedef {import('./types').SourceWrapper} SourceWrapper */

/**
 * Wrapper around V1/V2 source plugins with some more convenient aliases.
 *
 * Ideally we get rid of this in like a year and only support hot-swappable sources…
 *
 * @implements {SourceWrapper}
 */
class LegacySourceWrapper {
  /**
   * @param {Uwave} uw
   * @param {string} sourceType
   * @param {import('./types').StaticSourcePlugin} sourcePlugin
   */
  constructor(uw, sourceType, sourcePlugin) {
    this.uw = uw;
    this.type = sourceType;
    this.plugin = sourcePlugin;
  }

  get apiVersion() {
    return this.plugin.api || 1;
  }

  /**
   * Add a default sourceType property to a list of media items.
   *
   * Media items can provide their own sourceType, too, so media sources can
   * aggregate items from different source types.
   *
   * @param {Omit<PlaylistItemDesc, 'sourceType'>[]} items
   * @returns {PlaylistItemDesc[]}
   */
  addSourceType(items) {
    return items.map((item) => ({
      sourceType: this.type,
      ...item,
    }));
  }

  /**
   * Find a single media item by ID.
   *
   * @param {User} user
   * @param {string} id
   * @returns {Promise<PlaylistItemDesc | undefined>}
   */
  async getOne(user, id) {
    const [item] = await this.get(user, [id]);
    return item;
  }

  /**
   * Find several media items by ID.
   *
   * @param {User} user
   * @param {string[]} ids
   * @returns {Promise<PlaylistItemDesc[]>}
   */
  async get(user, ids) {
    let items;
    if (this.plugin.api === 2) {
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
   *
   * @param {User} user
   * @param {string} query
   * @param {import('type-fest').JsonValue} [page]
   * @returns {Promise<Page<PlaylistItemDesc, import('type-fest').JsonValue>>}
   */
  async search(user, query, page) {
    const context = new SourceContext(this.uw, this, user);

    /** @type {PlaylistItemDesc[] | undefined} */
    let results;
    if (this.plugin.api === 2) {
      results = await this.plugin.search(context, query, page);
    } else {
      results = await this.plugin.search(query, page);
    }

    return new Page(this.addSourceType(results), {
      current: page ?? null,
    });
  }

  /**
   * Unsupported for legacy sources.
   * @returns {Promise<never>}
   */
  async getUserPlaylists() {
    throw new SourceNoImportError({ name: this.type });
  }

  /**
   * Unsupported for legacy sources.
   * @returns {Promise<never>}
   */
  async getPlaylistItems() {
    throw new SourceNoImportError({ name: this.type });
  }

  /**
   * Import *something* from this media source. Because media sources can
   * provide wildly different imports, üWave trusts clients to know what they're
   * doing.
   *
   * @param {User} user
   * @param {{}} values
   * @returns {Promise<unknown>}
   */
  'import'(user, values) {
    const importContext = new ImportContext(this.uw, this, user);
    if (this.plugin.api === 2 && this.plugin.import != null) {
      return this.plugin.import(importContext, values);
    }
    throw new SourceNoImportError({ name: this.type });
  }
}

/**
 * @implements {SourceWrapper}
 */
class ModernSourceWrapper {
  /**
   * @param {Uwave} uw
   * @param {string} sourceType
   * @param {import('./types').SourcePluginV3Instance<import('type-fest').JsonValue>} sourcePlugin
   */
  constructor(uw, sourceType, sourcePlugin) {
    this.uw = uw;
    this.type = sourceType;
    this.plugin = sourcePlugin;
  }

  // eslint-disable-next-line class-methods-use-this
  get apiVersion() {
    // Can pass this number in through the constructor in the future.
    return 3;
  }

  /**
   * Add a default sourceType property to a list of media items.
   *
   * Media items can provide their own sourceType, too, so media sources can
   * aggregate items from different source types.
   *
   * @param {Omit<PlaylistItemDesc, 'sourceType'>[]} items
   * @returns {PlaylistItemDesc[]}
   * @private
   */
  addSourceType(items) {
    return items.map((item) => ({
      sourceType: this.type,
      ...item,
    }));
  }

  /**
   * Find a single media item by ID.
   *
   * @param {User} user
   * @param {string} id
   * @returns {Promise<PlaylistItemDesc | undefined>}
   */
  async getOne(user, id) {
    const [item] = await this.get(user, [id]);
    return item;
  }

  /**
   * Find several media items by ID.
   *
   * @param {User} user
   * @param {string[]} ids
   * @returns {Promise<PlaylistItemDesc[]>}
   */
  async get(user, ids) {
    const context = new SourceContext(this.uw, this, user);
    const items = await this.plugin.get(context, ids);
    return this.addSourceType(items);
  }

  /**
   * Search this media source for items. Parameters can really be anything, but
   * will usually include a search string `query` and a page identifier `page`.
   *
   * @param {User} user
   * @param {string} query
   * @param {import('type-fest').JsonValue} [page]
   * @returns {Promise<Page<PlaylistItemDesc, import('type-fest').JsonValue>>}
   */
  async search(user, query, page) {
    const context = new SourceContext(this.uw, this, user);

    const results = await this.plugin.search(context, query, page);
    results.data = this.addSourceType(results.data);
    return results;
  }

  /**
   * Get playlists for a specific user from this media source.
   *
   * @param {User} user
   * @param {string} userID
   * @returns {Promise<Page<unknown, import('type-fest').JsonValue>>}
   */
  async getUserPlaylists(user, userID) {
    if (!has(this.plugin, 'getUserPlaylists') || this.plugin.getUserPlaylists == null) {
      throw new SourceNoImportError({ name: this.type });
    }

    const context = new SourceContext(this.uw, this, user);
    return this.plugin.getUserPlaylists(context, userID);
  }

  /**
   * Get playlists for a specific user from this media source.
   *
   * @param {User} user
   * @param {string} playlistID
   * @returns {Promise<Page<PlaylistItemDesc, import('type-fest').JsonValue>>}
   */
  async getPlaylistItems(user, playlistID) {
    if (!has(this.plugin, 'getPlaylistItems') || this.plugin.getPlaylistItems == null) {
      throw new SourceNoImportError({ name: this.type });
    }

    const context = new SourceContext(this.uw, this, user);
    return this.plugin.getPlaylistItems(context, playlistID);
  }

  /**
   * Unsupported for modern media sources.
   *
   * @returns {Promise<never>}
   */
  async 'import'() {
    throw new SourceNoImportError({ name: this.type });
  }
}

exports.LegacySourceWrapper = LegacySourceWrapper;
exports.ModernSourceWrapper = ModernSourceWrapper;
