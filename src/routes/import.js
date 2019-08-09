import router from 'router';
import route from '../route';
import protect from '../middleware/protect';
import * as controller from '../controllers/import';

export default function importRoutes() {
  return router()
    // * /import/:source/:action - Call an import source.
    .all(
      '/:source/:action',
      protect(),
      route(controller.importAction),
    )
    // * /import/:source - Call an import source.
    .all(
      '/:source',
      protect(),
      route(controller.importAction),
    );
}
