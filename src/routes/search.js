'use strict';

const { Router } = require('express');
const route = require('../route');
const protect = require('../middleware/protect');
const schema = require('../middleware/schema');
const controller = require('../controllers/search');
const validations = require('../validations');

function searchRoutes() {
  return Router()
    .use(protect())
    // GET /search/ - Search for media across all sources.
    .get(
      '/',
      schema(validations.searchAll),
      route(controller.searchAll),
    )
    // GET /search/:source - Search for media in a single source.
    .get(
      '/:source',
      schema(validations.search),
      route(controller.search),
    );
}

module.exports = searchRoutes;
