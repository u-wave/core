'use strict';

const toItemResponse = require('../utils/toItemResponse');

async function list(req) {
  const { acl } = req.uwave;

  const roles = await acl.getAllRoles();

  return toItemResponse(roles, {
    url: req.fullUrl,
  });
}

async function createRole(req, res) {
  const { name } = req.params;
  const { permissions } = req.body;
  const { acl } = req.uwave;

  const role = await acl.createRole(name, permissions);

  res.status(201);
  return toItemResponse(role, {
    url: req.fullUrl,
  });
}

async function deleteRole(req, res) {
  const { name } = req.params;
  const { acl } = req.uwave;

  await acl.deleteRole(name);

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

exports.list = list;
exports.createRole = createRole;
exports.deleteRole = deleteRole;
