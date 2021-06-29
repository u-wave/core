'use strict';

const { Router } = require('express');
const route = require('../route');
const validations = require('../validations');
const protect = require('../middleware/protect');
const schema = require('../middleware/schema');
const controller = require('../controllers/motd');

function motdRoutes() {
  return Router()
    // GET /motd/ - Get the message of the day.
    .get(
      '/',
      route(controller.getMotd),
    )
    // PUT /motd/ - Set the message of the day.
    .put(
      '/',
      protect('motd.set'),
      schema(validations.setMotd),
      route(controller.setMotd),
    );
}

module.exports = motdRoutes;
