'use strict';

const { LoginRequiredError, PermissionError } = require('../errors');
const wrapMiddleware = require('../utils/wrapMiddleware');

/**
 * @param {string} role
 */
function protect(role) {
  return wrapMiddleware(async (req) => {
    const { acl } = req.uwave;

    if (!req.user) {
      throw new LoginRequiredError();
    }
    if (role && !(await acl.isAllowed(req.user, role))) {
      throw new PermissionError({ requiredRole: role });
    }
  });
}

module.exports = protect;
