'use strict';

function route(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res))
      .then((json) => {
        res.json(json);
      })
      .catch(next);
  };
}

module.exports = route;
