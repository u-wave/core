'use strict';

const { Router } = require('express');
const route = require('../route');
const protect = require('../middleware/protect');
const controller = require('../controllers/bans');

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

module.exports = banRoutes;
