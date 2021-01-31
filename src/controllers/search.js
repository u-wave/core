'use strict';

const debug = require('debug')('uwave:http:search');
const { isEqual } = require('lodash');
const { SourceNotFoundError } = require('../errors');
const toListResponse = require('../utils/toListResponse');

// TODO should be deprecated once the Web client uses the better single-source route.
async function searchAll(req) {
  const { user } = req;
  const { query } = req.query;
  const uw = req.uwave;
  const sourceNames = uw.sources.map((source) => source.type);
  const searches = uw.sources.map((source) => (
    source.search(user, query).catch((error) => {
      debug(error);
      // Default to empty search on failure, for now.
      return [];
    })
  ));

  const searchResults = await Promise.all(searches);

  const combinedResults = {};
  sourceNames.forEach((name, index) => {
    combinedResults[name] = searchResults[index];
  });

  return combinedResults;
}

async function updateSourceData(uw, updates) {
  const { Media } = uw.models;
  const ops = [];
  debug('updating source data', updates);
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

async function search(req) {
  const { user } = req;
  const { source: sourceName } = req.params;
  const { query } = req.query;
  const uw = req.uwave;
  const { Media } = uw.models;

  const source = uw.source(sourceName);
  if (!source) {
    throw new SourceNotFoundError({ name: sourceName });
  }

  const searchResults = await source.search(user, query);

  const searchResultsByID = new Map();
  searchResults.forEach((result) => {
    searchResultsByID.set(result.sourceID, result);
  });

  // Track medias whose `sourceData` property no longer matches that from the source.
  // This can happen because the media was actually changed, but also because of new
  // features in the source implementation.
  const mediasNeedSourceDataUpdate = new Map();

  const mediasInSearchResults = await Media.find({
    sourceType: sourceName,
    sourceID: { $in: Array.from(searchResultsByID.keys()) },
  });

  const mediaBySourceID = new Map();
  mediasInSearchResults.forEach((media) => {
    mediaBySourceID.set(media.sourceID, media);

    const freshMedia = searchResultsByID.get(media.sourceID);
    if (freshMedia && !isEqual(media.sourceData, freshMedia.sourceData)) {
      mediasNeedSourceDataUpdate.set(media._id, freshMedia.sourceData);
    }
  });

  const playlistsByMediaID = await uw.playlists.getPlaylistsContainingAnyMedia(
    mediasInSearchResults,
    { author: user._id },
  );

  searchResults.forEach((result) => {
    const media = mediaBySourceID.get(result.sourceID);
    if (media) {
      result.inPlaylists = playlistsByMediaID.get(media._id.toString());
    }
  });

  // don't wait for this to complete
  updateSourceData(uw, mediasNeedSourceDataUpdate).catch((error) => {
    debug('sourceData update failed', error);
  });

  return toListResponse(searchResults, {
    url: req.fullUrl,
    included: {
      playlists: ['inPlaylists'],
    },
  });
}

exports.search = search;
exports.searchAll = searchAll;
