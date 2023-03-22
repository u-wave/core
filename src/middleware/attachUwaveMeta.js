/**
 *
 * @param {import('../HttpApi').HttpApi} httpApi
 * @param {import('../Uwave').default} uw
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
