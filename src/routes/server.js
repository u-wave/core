import router from 'router';
import route from '../route';
import * as controller from '../controllers/server';

export default function serverRoutes() {
  return router()
    // GET /server/time - Show the current server time.
    .get(
      '/time',
      route(controller.getServerTime),
    );
}
