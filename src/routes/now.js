'use strict';

const { Router } = require('express');
const route = require('../route');
const controller = require('../controllers/now');

function nowRoute() {
  return Router()
    // GET /now/ - Get a combined view of the current state.
    .get(
      '/',
      route(controller.getState),
    );
}

module.exports = nowRoute;
