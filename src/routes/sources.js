'use strict';

const router = require('router');
const route = require('../route');
const protect = require('../middleware/protect');
const schema = require('../middleware/schema');
const controller = require('../controllers/sources');
const validations = require('../validations');

function sourceRoutes() {
  return router()
    .use(protect())
    // GET /sources/:source/search - Search for media in a single source.
    .get(
      '/:source/search',
      schema(validations.search),
      route(controller.search),
    )
    // GET /sources/:source/channels/:userID/playlists - Get playlists for a user on the media source.
    .get(
      '/:source/channels/:userID/playlists',
      route(controller.getChannelPlaylists),
    )
    // GET /sources/:source/channels/:userID/playlists - Get items for a playlist on the media source.
    .get(
      '/:source/playlists/:playlistID/media',
      route(controller.getPlaylistItems),
    );
}

module.exports = sourceRoutes;
