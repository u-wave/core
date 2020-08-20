'use strict';

const router = require('router');
const route = require('../route');
const protect = require('../middleware/protect');
const controller = require('../controllers/search');

function searchRoutes() {
  return router()
    .use(protect())
    // GET /search/ - Search for media across all sources.
    .get(
      '/',
      route(controller.searchAll),
    )
    // GET /search/:source - Search for media in a single source.
    .get(
      '/:source',
      route(controller.search),
    );
}

module.exports = searchRoutes;
