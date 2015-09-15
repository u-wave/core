import jwt from 'jsonwebtoken';

function checkAuth(router) {
  router.use((req, res, next) => {
    if (/^\/v1\/auth\/(login|register)$/i.test(req.path)) return next();

    if (!req.query.token) {
      return res.status(422).json({
        'error': 'no token set'
      });
    }

    // TODO: should token be static in config or generated every x time units?
    jwt.verify(req.query.body, 'testSecret', (err, decoded) => {
      // TODO: check if token is valid and either send back 200 with the required data
      // or 403
    });
  });
}

function checkPermission(router) {
  router.use((req, res, next) => {
    // TODO: add permission handling
  });
}

function rateLimiter(router) {
  router.use((req, res, next) => {
    // TODO: add rate limiting
  });
}

export default function middleware(router, config) {
  if (!router || !config) return;

  if (config.rateLimiter) {
    rateLimiter(router);
  }

  if (config.checkAuthentication) {
    checkAuth(router);
  }

  if (config.checkPermission) {
    checkPermission(router);
  }
}
