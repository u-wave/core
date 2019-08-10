import router from 'router';
import route from '../route';
import protect from '../middleware/protect';
import * as controller from '../controllers/bans';

export default function banRoutes() {
  return router()
    .get(
      '/',
      protect('users.bans.list'),
      route(controller.getBans),
    )

    .post(
      '/',
      protect('users.bans.add'),
      route(controller.addBan),
    )

    .delete(
      '/:userID',
      protect('users.bans.remove'),
      route(controller.removeBan),
    );
}
