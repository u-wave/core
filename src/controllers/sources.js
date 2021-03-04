'use strict';

const {
  SourceNotFoundError,
  SourceNoImportError,
} = require('../errors');
const searchController = require('./search');
const toListResponse = require('../utils/toListResponse');

function getImportableSource(req) {
  const uw = req.uwave;
  const { source: sourceName } = req.params;

  const source = uw.source(sourceName);
  if (!source) {
    throw new SourceNotFoundError({ name: sourceName });
  }
  if (!source.import) {
    throw new SourceNoImportError({ name: sourceName });
  }
  if (source.apiVersion < 3) {
    throw new SourceNoImportError({ name: sourceName });
  }

  return source;
}

async function getChannelPlaylists(req) {
  const uw = req.uwave;
  const source = getImportableSource(req);
  const { userID } = req.params;

  const items = await source.getUserPlaylists(userID);
  return toListResponse(items, {
    url: req.fullUrl,
  });
}

async function getPlaylistItems(req) {
  const uw = req.uwave;
  const source = getImportableSource(req);
  const { playlistID } = req.params;

  const items = await source.getPlaylistItems(playlistID);
  return toListResponse(items, {
    url: req.fullUrl,
  });
}

exports.search = searchController.search;
exports.getChannelPlaylists = getChannelPlaylists;
exports.getPlaylistItems = getPlaylistItems;
