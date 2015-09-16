import jwt from 'jsonwebtoken';
import debug from 'debug';

export default function authenticator(router, config = {}) {
  const regex = [];
  const log = debug('middleware:authenticator');

  if (Array.isArray(config.exclude) && config.exclude.length > 0) {
    config.exclude.forEach(rx => {
      regex.push(RegExp(rx.expression, rx.options));
    });
  }

  log(`registered ${regex.length} exclusion ${regex.length === 1 ? 'rule' : 'rules'}`);

  router.use((req, res, next) => {
    if (regex) {
      for (let i = regex.length - 1; i >= 0; i--) {
        if (regex[i].test(req.path)) return next();
      }
    }

    if (!req.query.token) {
      return res.status(422).json('no token set');
    }

    // TODO: should token be static in config or generated every x time units?
    jwt.verify(req.query.body, config.secret, (err, decoded) => {
      if (err) {
        log(`could not verify token '${req.query.body}'`);
        res.status(422).json('could not verify token');
      }
      // TODO: check if token is valid
      next();
    });
  });
}
