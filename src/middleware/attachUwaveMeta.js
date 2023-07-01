/**
 *
 * @param {import('../HttpApi.js').HttpApi} httpApi
 * @param {import('../Uwave.js').default} uw
 * @returns {import('express').RequestHandler}
 */
function attachUwaveMeta(httpApi, uw) {
  return (req, res, next) => {
    if (!req.uwave) {
      req.uwaveHttp = httpApi;
      req.uwave = uw;
    }
    next();
  };
}

export default attachUwaveMeta;
