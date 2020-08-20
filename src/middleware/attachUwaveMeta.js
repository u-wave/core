'use strict';

function attachUwaveMeta(httpApi, uw) {
  return (req, res, next) => {
    if (!req.uwave) {
      req.uwaveHttp = httpApi;
      req.uwave = uw;

      // Backwards compat?
      req.uwaveApiV1 = httpApi;
    }
    next();
  };
}

module.exports = attachUwaveMeta;
