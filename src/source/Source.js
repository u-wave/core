'use strict';

const has = require('has');
const { SourceNoImportError } = require('../errors');
const SourceContext = require('./SourceContext');
const ImportContext = require('./ImportContext');

/** @typedef {import('../Uwave')} Uwave */
/** @typedef {import('../models').User} User */
/** @typedef {import('../models').Playlist} Playlist */
/** @typedef {import('../plugins/playlists').PlaylistItemDesc} PlaylistItemDesc */

/**
 * @typedef {object} SourceWrapper
 * @prop {number} apiVersion
 * @prop {(user: User, id: string) => Promise<PlaylistItemDesc | undefined>} getOne
 * @prop {(user: User, ids: string[]) => Promise<PlaylistItemDesc[]>} get
 * @prop {(user: User, query: string, page?: unknown) => Promise<PlaylistItemDesc[]>} search
 * @prop {(user: User, userID: string) => Promise<unknown[]>} getUserPlaylists
 * @prop {(user: User, playlistID: string) => Promise<PlaylistItemDesc[]>} getPlaylistItems
 */

/**
 * @typedef {object} SourcePluginV1
 * @prop {undefined|1} api
 * @prop {(ids: string[]) => Promise<PlaylistItemDesc[]>} get
 * @prop {(query: string, page: unknown, ...args: unknown[]) => Promise<PlaylistItemDesc[]>} search
 *
 * @typedef {object} SourcePluginV2
 * @prop {2} api
 * @prop {(context: SourceContext, ids: string[]) => Promise<PlaylistItemDesc[]>} get
 * @prop {(
 *   context: SourceContext,
 *   query: string,
 *   page: unknown,
 *   ...args: unknown[]
 * ) => Promise<PlaylistItemDesc[]>} search
 * @prop {(context: ImportContext, ...args: unknown[]) => Promise<unknown>} [import]
 */

/**
 * Wrapper around source plugins with some more convenient aliases.
 */
class LegacySourceWrapper {
  /**
   * @param {Uwave} uw
   * @param {string} sourceType
   * @param {SourcePluginV1 | SourcePluginV2} sourcePlugin
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
   * @param {unknown} [page]
   * @returns {Promise<PlaylistItemDesc[]>}
   */
  async search(user, query, page) {
    const context = new SourceContext(this.uw, this, user);

    let results;
    if (this.plugin.api === 2) {
      results = await this.plugin.search(context, query, page);
    } else {
      results = await this.plugin.search(query, page);
    }
    return this.addSourceType(results);
  }

  /**
   * Unsupported for legacy sources.
   */
  async getUserPlaylists() {
    throw new SourceNoImportError({ name: this.type });
  }

  /**
   * Unsupported for legacy sources.
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
   * @param {unknown[]} args
   */
  'import'(user, ...args) {
    const importContext = new ImportContext(this.uw, this, user);
    if (this.plugin.api === 2 && this.plugin.import != null) {
      return this.plugin.import(importContext, ...args);
    }
    throw new SourceNoImportError({ name: this.type });
  }
}

/**
 * @typedef {object} SourcePluginV3Statics
 * @prop {3} api
 * @prop {string} sourceName
 * @prop {import('ajv').JSONSchemaType<unknown> & { 'uw:key': string }} schema
 * @typedef {object} SourcePluginV3Instance
 * @prop {(context: SourceContext, ids: string[]) => Promise<PlaylistItemDesc[]>} get
 * @prop {(context: SourceContext, query: string, page: unknown) => Promise<PlaylistItemDesc[]>}
 *     search
 * @prop {(context: SourceContext, userID: string) => Promise<unknown[]>} [getUserPlaylists]
 * @prop {(context: SourceContext, sourceID: string) => Promise<PlaylistItemDesc[]>}
 *     [getPlaylistItems]
 * @prop {() => void} [close]
 * @typedef {new(options: unknown) => SourcePluginV3Instance} SourcePluginV3Constructor
 * @typedef {SourcePluginV3Constructor & SourcePluginV3Statics} SourcePluginV3
 */

class ModernSourceWrapper {
  /**
   * @param {Uwave} uw
   * @param {string} sourceType
   * @param {SourcePluginV3Instance} sourcePlugin
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
   * @param {unknown} [page]
   * @returns {Promise<PlaylistItemDesc[]>}
   */
  async search(user, query, page) {
    const context = new SourceContext(this.uw, this, user);

    const results = await this.plugin.search(context, query, page);
    return this.addSourceType(results);
  }

  /**
   * Get playlists for a specific user from this media source.
   *
   * @param {User} user
   * @param {string} userID
   */
  async getUserPlaylists(user, userID) {
    if (!has(this.plugin, 'getUserPlaylists')) {
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
   */
  async getPlaylistItems(user, playlistID) {
    if (!has(this.plugin, 'getPlaylistItems')) {
      throw new SourceNoImportError({ name: this.type });
    }

    const context = new SourceContext(this.uw, this, user);
    return this.plugin.getPlaylistItems(context, playlistID);
  }

  /**
   * Unsupported for modern media sources.
   */
  'import'() {
    throw new SourceNoImportError({ name: this.type });
  }
}

exports.LegacySourceWrapper = LegacySourceWrapper;
exports.ModernSourceWrapper = ModernSourceWrapper;
