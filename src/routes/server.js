const router = require('router');
const route = require('../route');
const protect = require('../middleware/protect');
const controller = require('../controllers/server');

function serverRoutes() {
  return router()
    // GET /server/time - Show the current server time.
    .get(
      '/time',
      route(controller.getServerTime),
    )
    // GET /server/config/schema - Show the schema describing server configuration.
    .get(
      '/config/schema',
      protect('admin'),
      route(controller.getConfigSchema),
    )
    // GET /server/config
    .get(
      '/config',
      protect('admin'),
      route(controller.getAllConfig),
    )
    // GET /server/config/:key
    .get(
      '/config/:key',
      protect('admin'),
      route(controller.getConfig),
    )
    // PUT /server/config/:key
    .get(
      '/config/:key',
      protect('admin'),
      route(controller.updateConfig),
    );
}

module.exports = serverRoutes;
