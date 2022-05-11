'use strict';

const debug = require('debug')('uwave:http:search');
const { isEqual } = require('lodash');
const { SourceNotFoundError } = require('../errors');
const toPaginatedResponse = require('../utils/toPaginatedResponse');

/** @typedef {import('../models').Playlist} Playlist */
/** @typedef {import('../plugins/playlists').PlaylistItemDesc} PlaylistItemDesc */

// TODO should be deprecated once the Web client uses the better single-source route.
/**
 * @type {import('../types').AuthenticatedController<never, SearchQuery, never>}
 */
async function searchAll(req) {
  const { user } = req;
  const { query } = req.query;
  const uw = req.uwave;
  const sourceNames = uw.sources.map((source) => source.type);
  const searches = uw.sources.map((source) => (
    source.search(user, query).catch((error) => {
      debug(error);
      // Default to empty search on failure, for now.
    })
  ));

  const searchResults = await Promise.all(searches);

  const combinedResults = Object.fromEntries(
    sourceNames.map((name, index) => [name, searchResults[index]?.data ?? []]),
  );

  return combinedResults;
}

/**
 * @param {import('../Uwave')} uw
 * @param {Map<string, Record<string, unknown>>} updates
 */
async function updateSourceData(uw, updates) {
  const { Media } = uw.models;
  const ops = [];
  debug('updating source data', [...updates.keys()]);
  for (const [id, sourceData] of updates.entries()) {
    ops.push({
      updateOne: {
        filter: { _id: id },
        update: {
          $set: { sourceData },
        },
      },
    });
  }
  await Media.bulkWrite(ops);
}

/**
 * @typedef {object} SearchParams
 * @prop {string} source
 *
 * @typedef {object} SearchQuery
 * @prop {string} query
 * @prop {string} [include]
*/

/**
 * @type {import('../types').AuthenticatedController<SearchParams, SearchQuery, never>}
 */
async function search(req) {
  const { user } = req;
  const { source: sourceName } = req.params;
  const { query, include } = req.query;
  const uw = req.uwave;
  const { Media } = uw.models;

  const source = uw.source(sourceName);
  if (!source) {
    throw new SourceNotFoundError({ name: sourceName });
  }

  /** @type {import('../Page')<PlaylistItemDesc & { inPlaylists?: Playlist[] }, any>} */
  const searchResults = await source.search(user, query);

  const searchResultsByID = new Map();
  searchResults.data.forEach((result) => {
    searchResultsByID.set(result.sourceID, result);
  });

  // Track medias whose `sourceData` property no longer matches that from the source.
  // This can happen because the media was actually changed, but also because of new
  // features in the source implementation.
  const mediasNeedSourceDataUpdate = new Map();

  /** @type {import('../models').Media[]} */
  const mediasInSearchResults = await Media.find({
    sourceType: sourceName,
    sourceID: { $in: Array.from(searchResultsByID.keys()) },
  });

  /** @type {Map<string, import('../models').Media>} */
  const mediaBySourceID = new Map();
  mediasInSearchResults.forEach((media) => {
    mediaBySourceID.set(media.sourceID, media);

    const freshMedia = searchResultsByID.get(media.sourceID);
    if (freshMedia && !isEqual(media.sourceData, freshMedia.sourceData)) {
      mediasNeedSourceDataUpdate.set(media._id, freshMedia.sourceData);
    }
  });

  // don't wait for this to complete
  updateSourceData(uw, mediasNeedSourceDataUpdate).catch((error) => {
    debug('sourceData update failed', error);
  });

  // Only include related playlists if requested
  if (typeof include === 'string' && include.split(',').includes('playlists')) {
    const playlistsByMediaID = await uw.playlists.getPlaylistsContainingAnyMedia(
      mediasInSearchResults.map((media) => media._id),
      { author: user._id },
    ).catch((error) => {
      debug('playlists containing media lookup failed', error);
      // just omit the related playlists if we timed out or crashed
      return new Map();
    });

    searchResults.data.forEach((result) => {
      const media = mediaBySourceID.get(String(result.sourceID));
      if (media) {
        result.inPlaylists = playlistsByMediaID.get(media._id.toString());
      }
    });

    return toPaginatedResponse(searchResults, {
      baseUrl: req.fullUrl,
      included: {
        playlists: ['inPlaylists'],
      },
    });
  }

  return toPaginatedResponse(searchResults, {
    baseUrl: req.fullUrl,
  });
}

exports.search = search;
exports.searchAll = searchAll;
