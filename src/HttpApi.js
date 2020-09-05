'use strict';

const Router = require('router');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const debug = require('debug')('uwave:http-api');

// routes
const authenticate = require('./routes/authenticate');
const bans = require('./routes/bans');
const search = require('./routes/search');
const server = require('./routes/server');
const users = require('./routes/users');
const now = require('./routes/now');
const imports = require('./routes/import');

// middleware
const addFullUrl = require('./middleware/addFullUrl');
const attachUwaveMeta = require('./middleware/attachUwaveMeta');
const rateLimit = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');

// utils
const AuthRegistry = require('./AuthRegistry');
const matchOrigin = require('./utils/matchOrigin');

const optionsSchema = require('./schemas/httpApi.json');

function defaultCreatePasswordResetEmail({ token, requestUrl }) {
  const parsed = new URL(requestUrl);
  const { hostname } = parsed;
  const resetLink = new URL(`/reset/${token}`, parsed);
  return {
    from: `noreply@${hostname}`,
    subject: 'üWave Password Reset Request',
    text: `
      Hello,

      To reset your password, please visit:
      ${resetLink}
    `,
  };
}

class UwaveHttpApi extends Router {
  static async plugin(uw, options) {
    uw.config.register(optionsSchema['uw:key'], optionsSchema);

    let runtimeOptions = await uw.config.get(optionsSchema['uw:key']);
    uw.config.on('set', (key, value) => {
      if (key === 'u-wave:api') {
        runtimeOptions = value;
      }
    });

    debug('setup', runtimeOptions);
    uw.express = express();
    uw.server = http.createServer(uw.express);

    uw.httpApi = new UwaveHttpApi(uw, {
      secret: options.secret,
    });

    uw.express.use(helmet({
      referrerPolicy: {
        policy: ['origin-when-cross-origin'],
      },
    }));

    const corsOptions = {
      origin(origin, callback) {
        callback(null, matchOrigin(origin, runtimeOptions.allowedOrigins));
      },
    };
    uw.express.options('/api/*', cors(corsOptions));
    uw.express.use('/api', cors(corsOptions), uw.httpApi);
    // An older name
    uw.express.use('/v1', cors(corsOptions), uw.httpApi);
  }

  // Set up error handlers after all the plugins have registered their routes.
  static async errorHandling(uw) {
    debug('after');
    uw.httpApi.use(errorHandler());
    uw.express.use((error, req, res, next) => {
      debug(error);
      next(error);
    });
  }

  constructor(uw, options = {}) {
    if (!uw || !('mongo' in uw)) {
      throw new TypeError('Expected a u-wave-core instance in the first parameter. If you are '
        + 'developing, you may have to upgrade your u-wave-* modules.');
    }

    if (!options.secret) {
      throw new TypeError('"options.secret" is empty. This option is used to sign authentication '
        + 'keys, and is required for security reasons.');
    }

    if (options.recaptcha && !options.recaptcha.secret) {
      throw new TypeError('ReCaptcha validation is enabled, but "options.recaptcha.secret" is '
        + 'not set. Please set "options.recaptcha.secret" to your ReCaptcha '
        + 'secret, or disable ReCaptcha validation by setting "options.recaptcha" '
        + 'to "false".');
    }

    if (options.onError != null && typeof options.onError !== 'function') {
      throw new TypeError('"options.onError" must be a function.');
    }

    const router = super(options);

    this.uw = uw;

    this.authRegistry = new AuthRegistry(uw.redis);

    this
      .use(bodyParser.json())
      .use(cookieParser())
      .use(uw.passport.initialize())
      .use(addFullUrl())
      .use(this.attachUwaveToRequest())
      .use(uw.passport.authenticate('jwt'))
      .use(rateLimit('api-http', { max: 500, duration: 60 * 1000 }));

    this
      .use('/auth', authenticate(this, {
        secret: options.secret,
        mailTransport: options.mailTransport,
        recaptcha: options.recaptcha,
        createPasswordResetEmail:
          options.createPasswordResetEmail || defaultCreatePasswordResetEmail,
      }))
      .use('/bans', bans(this))
      .use('/import', imports(this))
      .use('/now', now(this))
      .use('/search', search(this))
      .use('/server', server())
      .use('/users', users(this));

    return router;
  }

  /**
   * Create middleware to attach the u-wave-core instance and the u-wave-http-api
   * instance to incoming requests. This can be used to access eg. configuration
   * options or session information inside other routes (ones not added by
   * u-wave-http-api).
   *
   * @return {Function} Middleware.
   */
  attachUwaveToRequest() {
    return attachUwaveMeta(this, this.uw);
  }
}

module.exports = UwaveHttpApi;
