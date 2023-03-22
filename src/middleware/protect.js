import { LoginRequiredError, PermissionError } from '../errors/index.js';
import wrapMiddleware from '../utils/wrapMiddleware.js';

/**
 * @param {string} [role]
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

export default protect;
