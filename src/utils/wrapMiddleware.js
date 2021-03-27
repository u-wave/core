'use strict';

/**
 * Wrap `async` middleware into an express style callback.
 *
 * @param {(
 *   req: import('../types').Request,
 *   res: import('express').Response
 * ) => Promise<void>} middleware
 * @returns {import('express').RequestHandler}
 */
function wrapMiddleware(middleware) {
  return (rawReq, res, next) => {
    /** @type {import('../types').Request} */
    // @ts-ignore
    const req = rawReq;

    middleware(req, res)
      .then(() => next(), next);
  };
}

module.exports = wrapMiddleware;
