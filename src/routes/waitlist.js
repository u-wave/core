'use strict';

const { Router } = require('express');
const route = require('../route');
const validations = require('../validations');
const protect = require('../middleware/protect');
const requireActiveConnection = require('../middleware/requireActiveConnection');
const schema = require('../middleware/schema');
const controller = require('../controllers/waitlist');

function waitlistRoutes() {
  return Router()
    // GET /waitlist/ - List users in the waitlist.
    .get(
      '/',
      route(controller.getWaitlist),
    )
    // POST /waitlist/ - Add a user to the waitlist.
    .post(
      '/',
      protect('waitlist.join'),
      requireActiveConnection(),
      schema(validations.joinWaitlist),
      route(controller.addToWaitlist),
    )
    // DELETE /waitlist/ - Clear the waitlist.
    .delete(
      '/',
      protect('waitlist.clear'),
      route(controller.clearWaitlist),
    )
    // PUT /waitlist/move - Move a user to a different position in the waitlist.
    .put(
      '/move',
      protect('waitlist.move'),
      schema(validations.moveWaitlist),
      route(controller.moveWaitlist),
    )
    // DELETE /waitlist/:id - Remove a user from the waitlist.
    .delete(
      '/:id',
      protect('waitlist.leave'),
      route(controller.removeFromWaitlist),
    )
    // PUT /waitlist/lock - Lock or unlock the waitlist.
    .put(
      '/lock',
      protect('waitlist.lock'),
      schema(validations.lockWaitlist),
      route(controller.lockWaitlist),
    );
}

module.exports = waitlistRoutes;
