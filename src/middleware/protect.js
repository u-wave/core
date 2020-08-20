'use strict';

const { PermissionError } = require('../errors');
const wrapMiddleware = require('../utils/wrapMiddleware');

function protect(role) {
  return wrapMiddleware(async (req) => {
    const { acl } = req.uwave;

    if (!req.user) {
      throw new PermissionError('You must be logged in to do this');
    }
    if (role && !(await acl.isAllowed(req.user, role))) {
      throw new PermissionError(`You must have the '${role}' role to do this.`);
    }
  });
}

module.exports = protect;
