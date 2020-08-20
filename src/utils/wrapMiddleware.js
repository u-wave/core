'use strict';

/**
 * Wrap `async` middleware into an express style callback.
 */
function wrapMiddleware(middleware) {
  return (req, res, next) => {
    middleware(req, res)
      .then(() => next(), next);
  };
}

module.exports = wrapMiddleware;
