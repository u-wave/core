const props = require('p-props');
const createDebug = require('debug');
const { SourceNotFoundError } = require('../errors');
const toListResponse = require('../utils/toListResponse');

const log = createDebug('uwave:http:search');

// TODO should be deprecated once the Web client uses the better single-source route.
function searchAll(req) {
  const { user } = req;
  const { query } = req.query;
  const uw = req.uwave;
  const promises = {};

  uw.sources.forEach((source) => {
    promises[source.type] = source.search(user, query)
      .catch((error) => {
        log(error.message);
        // Default to empty search on failure, for now.
        return [];
      });
  });

  return props(promises);
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
      result.playlists = playlistsByMediaID.get(media._id.toString());
    }
  });

  return toListResponse(searchResults, {
    url: req.fullUrl,
    included: {
      playlists: ['playlists'],
    },
  });
}

exports.search = search;
exports.searchAll = searchAll;
