const router = require('router');
const route = require('../route');
const protect = require('../middleware/protect');
const controller = require('../controllers/import');

function importRoutes() {
  return router()
    // * /import/:source/:action - Call an import source.
    .all(
      '/:source/:action',
      protect(),
      route(controller.importAction),
    )
    // * /import/:source - Call an import source.
    .all(
      '/:source',
      protect(),
      route(controller.importAction),
    );
}

module.exports = importRoutes;
