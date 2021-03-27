'use strict';

/**
 * Wrap `async` middleware into an express style callback.
 *
 * @param {(
 *   req: import('express').Request,
 *   res: import('express').Response
 * ) => Promise<void>} middleware
 * @returns {import('express').RequestHandler}
 */
function wrapMiddleware(middleware) {
  return (req, res, next) => {
    middleware(req, res)
      .then(() => next(), next);
  };
}

module.exports = wrapMiddleware;
