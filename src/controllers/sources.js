'use strict';

const { BadRequest } = require('http-errors');
const {
  SourceNotFoundError,
  SourceNoImportError,
} = require('../errors');
const searchController = require('./search');
const toPaginatedResponse = require('../utils/toPaginatedResponse');

/**
 * @param {import('../types').Request} req
 */
function getImportableSource(req) {
  const uw = req.uwave;
  const { source: sourceName } = req.params;

  const source = uw.source(sourceName);
  if (!source) {
    throw new SourceNotFoundError({ name: sourceName });
  }
  if (source.apiVersion < 3) {
    throw new SourceNoImportError({ name: sourceName });
  }

  return source;
}

/**
 * @type {import('../types').AuthenticatedController}
 */
async function getPlaylists(req) {
  const source = getImportableSource(req);
  const {
    userID,
  } = req.query;

  let items;

  if (userID) {
    items = await source.getUserPlaylists(req.user, userID);
  } else {
    throw new BadRequest('No playlist filter provided');
  }

  return toPaginatedResponse(items, {
    baseUrl: req.fullUrl,
  });
}

/**
 * @type {import('../types').AuthenticatedController}
 */
async function getPlaylistItems(req) {
  const source = getImportableSource(req);
  const { playlistID } = req.params;

  const items = await source.getPlaylistItems(req.user, playlistID);
  return toPaginatedResponse(items, {
    baseUrl: req.fullUrl,
  });
}

exports.search = searchController.search;
exports.getPlaylists = getPlaylists;
exports.getPlaylistItems = getPlaylistItems;
