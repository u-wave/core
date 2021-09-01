'use strict';

const { Router } = require('express');
const route = require('../route');
const protect = require('../middleware/protect');
const schema = require('../middleware/schema');
const controller = require('../controllers/sources');
const validations = require('../validations');

function sourceRoutes() {
  return Router()
    .use(protect())
    // GET /sources/:source/search - Search for media in a single source.
    .get(
      '/:source/search',
      schema(validations.search),
      route(controller.search),
    )
    // GET /sources/:source/playlists - List playlists from the media source.
    .get(
      '/:source/playlists',
      route(controller.getPlaylists),
    )
    // GET /sources/:source/channels/:userID/playlists - Get items for a playlist on the media
    // source.
    .get(
      '/:source/playlists/:playlistID/media',
      route(controller.getPlaylistItems),
    );
}

module.exports = sourceRoutes;
