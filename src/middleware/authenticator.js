import bluebird from 'bluebird';
import jwt from 'jsonwebtoken';
import redis from 'ioredis';
import debug from 'debug';

const verify = bluebird.promisify(jwt.verify);

export default function _authenticator(config = {}) {
  const regex = [];
  const log = debug('middleware:authenticator');

  if (Array.isArray(config.exclude) && config.exclude.length > 0) {
    config.exclude.forEach(rx => {
      regex.push(RegExp(rx.expression, rx.options));
    });
  }

  log(`registered ${regex.length} exclusion ${regex.length === 1 ? 'rule' : 'rules'}`);

  return function authenticator(req, res, next) {
    if (regex) {
      for (let i = regex.length - 1; i >= 0; i--) {
        if (regex[i].test(req.path)) return next();
      }
    }

    if (!req.query.token) {
      return res.status(422).json('no token set');
    }

    // TODO: should token be static in config or generated every x time units?
    verify(req.query.token, config.secret || 'test')
    .then(() => {
      return req.uwave.redis.hgetall(`user:${req.query.token}`);
    })
    .then(user => {
      req.user = user;
      next();
    })
    .catch(jwt.JsonWebTokenError, e => {
      log(`Token '${req.query.token.slice(0, 64)}...' was not valid.`);
      res.status(410).json('no user found');
    })
    .catch(redis.ReplyError, e => {
      log(`couldn't fetch data from redis. Err: ${e}`);
      res.status(410).json('no entry found for this token');
    })
    .catch(e => {
      log(`Uknown error: ${e}`);
      res.status(500).json('internal server error, please try again later');
    });
  };
}
