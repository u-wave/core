'use strict';

/**
 * @template {Record<string, string>} TParams
 * @template {import('qs').ParsedQs} TQuery
 * @template {import('type-fest').JsonObject} TBody
 * @template {any} TExtra
 * @param {(
 *   req: import('./types').Request<TParams, TQuery, TBody> & TExtra,
 *   res: import('express').Response,
 * ) => Promise<object>} handler
 * @returns {import('express').RequestHandler}
 */
function route(handler) {
  return (rawReq, res, next) => {
    /** @type {import('./types').Request<TParams, TQuery, TBody> & TExtra} */
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
