import { Router } from 'express';
import route from '../route.js';
import * as controller from '../controllers/now.js';

function nowRoute() {
  return Router()
    // GET /now/ - Get a combined view of the current state.
    .get(
      '/',
      route(controller.getState),
    );
}

export default nowRoute;
