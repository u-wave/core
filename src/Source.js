'use strict';

const debug = require('debug')('uwave:source');
const mergeAllOf = require('json-schema-merge-allof');
const { SourceNoImportError } = require('./errors');

/**
 * @typedef {import('./models').User} User
 * @typedef {import('./models').Playlist} Playlist
 * @typedef {import('./plugins/playlists').PlaylistItemDesc} PlaylistItemDesc
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
 *
 * @typedef {SourcePluginV1 | SourcePluginV2} SourcePlugin
 */

/**
 * Data holder for things that source plugins may require.
 */
class SourceContext {
  /**
   * @param {import('./Uwave')} uw
   * @param {Source} source
   * @param {User} user
   */
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

/**
 * Wrapper around source plugins with some more convenient aliases.
 */
class Source {
  /**
   * @param {import('./Uwave')} uw
   * @param {string} sourceType
   * @param {SourcePlugin} sourcePlugin
   */
  constructor(uw, sourceType, sourcePlugin) {
    this.uw = uw;
    this.type = sourceType;
    this.plugin = sourcePlugin;
  }

  get apiVersion() {
    return this.plugin.api || this.plugin.constructor.api || 1;
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
   * @returns {Promise<PlaylistItemDesc?>}
   */
  getOne(user, id) {
    return this.get(user, [id])
      .then((items) => items[0]);
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
   * @template {object} TPagination
   * @param {User} user
   * @param {string} query
   * @param {TPagination} [page]
   * @param {unknown[]} args
   * @returns {Promise<PlaylistItemDesc[]>}
   */
  async search(user, query, page, ...args) {
    let results;
    if (this.plugin.api === 2) {
      const context = new SourceContext(this.uw, this, user);
      results = await this.plugin.search(context, query, page, ...args);
    } else {
      results = await this.plugin.search(query, page, ...args);
    }
    return this.addSourceType(results);
  }

  /**
   * Get playlists for a specific user from this media source.
   */
  async getUserPlaylists(user, userID) {
    if (this.apiVersion < 3 || !this.plugin.getUserPlaylists) {
      throw new SourceNoImportError({ name: this.type });
    }

    const context = new SourceContext(this.uw, this, user);

    return this.plugin.getUserPlaylists(context, userID);
  }

  /**
   * Get playlists for a specific user from this media source.
   */
  async getPlaylistItems(user, playlistID) {
    if (this.apiVersion < 3 || !this.plugin.getPlaylistItems) {
      throw new SourceNoImportError({ name: this.type });
    }

    const context = new SourceContext(this.uw, this, user);
    return this.plugin.getPlaylistItems(context, playlistID);
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

  static async plugin(uw, { source: SourcePlugin, baseOptions = {} }) {
    debug('registering plugin', SourcePlugin);
    if (SourcePlugin.api == null || SourcePlugin.api < 3) {
      uw.source(SourcePlugin, baseOptions);
      return;
    }

    if (!SourcePlugin.sourceName) {
      throw new TypeError('Source plugin does not provide a `sourceName`');
    }

    async function readdSource(options) {
      debug('adding plugin', options);
      const { enabled, ...sourceOptions } = options;

      const oldSource = uw.removeSourceInternal(SourcePlugin.sourceName);
      if (oldSource && typeof oldSource.close === 'function') {
        await oldSource.close();
      }

      if (enabled) {
        const instance = new SourcePlugin({
          ...baseOptions,
          ...sourceOptions
        });

        const source = new Source(uw, SourcePlugin.sourceName, instance);
        uw.insertSourceInternal(SourcePlugin.sourceName, source);
      }
    }

    if (SourcePlugin.schema) {
      if (!SourcePlugin.schema['uw:key']) {
        throw new TypeError(`Option schema for media source does not specify an "uw:key" value`);
      }

      uw.config.register(SourcePlugin.schema['uw:key'], mergeAllOf({
        allOf: [
          {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                title: 'Enabled',
                default: false,
              },
            },
            required: ['enabled'],
          },
          SourcePlugin.schema
        ],
      }, { deep: false }));

      const initialOptions = await uw.config.get(SourcePlugin.schema['uw:key']);
      uw.config.on('set', (key, newOptions) => {
        if (key === SourcePlugin.schema['uw:key']) {
          readdSource(newOptions).catch((error) => {
            if (uw.options.onError) {
              uw.options.onError(error);
            } else {
              debug(error);
            }
          });
        }
      });

      await readdSource(initialOptions);
    } else {
      // The source does not support options
      await readdSource({});
    }
  }
}

exports.SourceContext = SourceContext;
exports.ImportContext = ImportContext;
exports.Source = Source;
