'use strict';

/**
 * @param {(
 *   req: import('./types').Request,
 *   res: import('express').Response,
 * ) => Promise<object>} handler
 * @returns {import('express').RequestHandler}
 */
function route(handler) {
  return (rawReq, res, next) => {
    /** @type {import('./types').Request} */
    // @ts-ignore
    const req = rawReq;

    Promise.resolve(handler(req, res))
      .then((json) => {
        res.json(json);
      })
      .catch(next);
  };
}

module.exports = route;
