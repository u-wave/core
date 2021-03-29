'use strict';

/**
 * @returns {import('express').RequestHandler}
 */
function addFullUrl() {
  return (req, res, next) => {
    Object.defineProperty(req, 'fullUrl', {
      get: () => `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    });
    next();
  };
}

module.exports = addFullUrl;
