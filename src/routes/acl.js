'use strict';

const { Router } = require('express');
const route = require('../route');
const validations = require('../validations');
const protect = require('../middleware/protect');
const schema = require('../middleware/schema');
const controller = require('../controllers/acl');

function aclRoutes() {
  return Router()
    // GET /roles - List available roles.
    .get(
      '/',
      route(controller.list),
    )
    // PUT /roles/:name - Create a new role.
    .put(
      '/:name',
      protect('acl.create'),
      schema(validations.createAclRole),
      route(controller.createRole),
    )
    // DELETE /roles/:name - Delete a new role.
    .delete(
      '/:name',
      protect('acl.delete'),
      schema(validations.deleteAclRole),
      route(controller.deleteRole),
    );
}

module.exports = aclRoutes;
