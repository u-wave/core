import router from 'router';
import route from '../route';
import protect from '../middleware/protect';
import * as controller from '../controllers/search';

export default function searchRoutes() {
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
