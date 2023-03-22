import { Router } from 'express';
import route from '../route.js';
import protect from '../middleware/protect.js';
import * as controller from '../controllers/bans.js';

function banRoutes() {
  return Router()
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

export default banRoutes;
