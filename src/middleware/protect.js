const { PermissionError } = require('../errors');
const wrapMiddleware = require('../utils/wrapMiddleware');

function protect(role) {
  return wrapMiddleware(async (req) => {
    if (!req.user) {
      throw new PermissionError('You must be logged in to do this');
    }
    if (role && !(await req.user.can(role))) {
      throw new PermissionError(`You must have the '${role}' role to do this.`);
    }
  });
}

module.exports = protect;
