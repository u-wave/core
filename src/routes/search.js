import { Router } from 'express';
import route from '../route.js';
import protect from '../middleware/protect.js';
import schema from '../middleware/schema.js';
import * as controller from '../controllers/search.js';
import * as validations from '../validations.js';

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

export default searchRoutes;
