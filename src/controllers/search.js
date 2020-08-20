'use strict';

const createDebug = require('debug');
const { SourceNotFoundError } = require('../errors');
const toListResponse = require('../utils/toListResponse');

const debug = createDebug('uwave:http:search');

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

async function search(req) {
  const { user } = req;
  const { source: sourceName } = req.params;
  const { query } = req.query;
  const uw = req.uwave;

  const source = uw.source(sourceName);
  if (!source) {
    throw new SourceNotFoundError({ name: sourceName });
  }

  const searchResults = await source.search(user, query);
  const sourceIDs = searchResults.map((result) => result.sourceID);

  const mediasInSearchResults = await uw.model('Media').find({
    sourceType: sourceName,
    sourceID: { $in: sourceIDs },
  });

  const mediaBySourceID = new Map();
  mediasInSearchResults.forEach((media) => {
    mediaBySourceID.set(media.sourceID, media);
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

  return toListResponse(searchResults, {
    url: req.fullUrl,
    included: {
      playlists: ['inPlaylists'],
    },
  });
}

exports.search = search;
exports.searchAll = searchAll;
