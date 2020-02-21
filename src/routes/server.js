const router = require('router');
const route = require('../route');
const controller = require('../controllers/server');

function serverRoutes() {
  return router()
    // GET /server/time - Show the current server time.
    .get(
      '/time',
      route(controller.getServerTime),
    );
}

module.exports = serverRoutes;
