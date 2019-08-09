import toItemResponse from '../utils/toItemResponse';

export async function list(req) {
  const { acl } = req.uwave;

  const roles = await acl.getAllRoles();

  return toItemResponse(roles, {
    url: req.fullUrl,
  });
}

export async function createRole(req) {
  const { name } = req.params;
  const { permissions } = req.body;
  const { acl } = req.uwave;

  const role = await acl.createRole(name, permissions);

  return toItemResponse(role, {
    url: req.fullUrl,
  });
}

export async function deleteRole(req) {
  const { name } = req.params;
  const { acl } = req.uwave;

  await acl.deleteRole(name);

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}
