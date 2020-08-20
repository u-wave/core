'use strict';

function route(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res))
      .then((json) => {
        res.status(200).json(json);
      })
      .catch(next);
  };
}

module.exports = route;
