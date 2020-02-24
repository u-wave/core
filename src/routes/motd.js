const router = require('router');
const route = require('../route');
const validations = require('../validations');
const protect = require('../middleware/protect');
const checkFields = require('../middleware/checkFields');
const controller = require('../controllers/motd');

function motdRoutes() {
  return router()
    // GET /motd/ - Get the message of the day.
    .get(
      '/',
      route(controller.getMotd),
    )
    // PUT /motd/ - Set the message of the day.
    .put(
      '/',
      protect('motd.set'),
      checkFields(validations.setMotd),
      route(controller.setMotd),
    );
}

module.exports = motdRoutes;
