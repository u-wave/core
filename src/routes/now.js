import router from 'router';
import route from '../route';
import * as controller from '../controllers/now';

export default function nowRoute() {
  return router()
    // GET /now/ - Get a combined view of the current state.
    .get(
      '/',
      route(controller.getState),
    );
}
