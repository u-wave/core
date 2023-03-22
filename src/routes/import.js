import { Router } from 'express';
import route from '../route.js';
import protect from '../middleware/protect.js';
import * as controller from '../controllers/import.js';

function importRoutes() {
  return Router()
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

export default importRoutes;
