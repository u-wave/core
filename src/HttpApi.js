'use strict';

const { randomUUID } = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const RedisSessionStore = require('connect-redis')(session);
const cors = require('cors');
const helmet = require('helmet').default;
const http = require('http');
const pinoHttp = require('pino-http').default;

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

/**
 * @param {{ token: string, requestUrl: string }} options
 * @returns {import('nodemailer').SendMailOptions}
 */
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

/**
 * @typedef {express.Router & { authRegistry: AuthRegistry }} HttpApi
 */

/**
 * @typedef {object} HttpApiOptions - Static options for the HTTP API.
 * @prop {string|Buffer} secret
 * @prop {boolean} [helmet]
 * @prop {(error: Error) => void} [onError]
 * @prop {{ secret: string }} [recaptcha]
 * @prop {import('nodemailer').Transport} [mailTransport]
 * @prop {(options: { token: string, requestUrl: string }) =>
 *   import('nodemailer').SendMailOptions} [createPasswordResetEmail]
 *
 * @typedef {object} HttpApiSettings - Runtime options for the HTTP API.
 * @prop {string[]} allowedOrigins
 */

/**
 * @param {import('./Uwave').Boot} uw
 * @param {HttpApiOptions} options
 */
async function httpApi(uw, options) {
  if (!options.secret) {
    throw new TypeError('"options.secret" is empty. This option is used to sign authentication '
      + 'keys, and is required for security reasons.');
  }

  if (options.onError != null && typeof options.onError !== 'function') {
    throw new TypeError('"options.onError" must be a function.');
  }

  const logger = uw.logger.child({
    ns: 'uwave:http-api',
  });

  uw.config.register(optionsSchema['uw:key'], optionsSchema);

  /** @type {HttpApiSettings} */
  // @ts-expect-error TS2322: get() always returns a validated object here
  let runtimeOptions = await uw.config.get(optionsSchema['uw:key']);
  const unsubscribe = uw.config.subscribe('u-wave:api', /** @param {HttpApiSettings} settings */ (settings) => {
    runtimeOptions = settings;
  });

  logger.debug(runtimeOptions, 'start HttpApi');
  uw.httpApi = Object.assign(express.Router(), {
    authRegistry: new AuthRegistry(uw.redis),
  });

  uw.httpApi
    .use(pinoHttp({
      genReqId: () => randomUUID(),
      quietReqLogger: true,
      logger,
    }))
    .use(bodyParser.json())
    .use(cookieParser())
    .use(session({
      name: 'uwsid',
      store: new RedisSessionStore({
        client: uw.redis,
      }),
      secret: options.secret.toString('hex'),
    }))
    .use(uw.passport.initialize())
    .use(addFullUrl())
    .use(attachUwaveMeta(uw.httpApi, uw))
    .use(uw.passport.authenticate('jwt'))
    .use(rateLimit('api-http', { max: 500, duration: 60 * 1000 }));

  uw.httpApi
    .use('/auth', authenticate(uw.passport, {
      secret: options.secret,
      mailTransport: options.mailTransport,
      recaptcha: options.recaptcha,
      createPasswordResetEmail:
        options.createPasswordResetEmail ?? defaultCreatePasswordResetEmail,
    }))
    .use('/bans', bans())
    .use('/import', imports())
    .use('/now', now())
    .use('/search', search())
    .use('/server', server())
    .use('/users', users());

  uw.express = express();
  uw.server = http.createServer(uw.express);
  if (options.helmet !== false) {
    uw.express.use(helmet({
      referrerPolicy: {
        policy: ['origin-when-cross-origin'],
      },
    }));
  }

  /** @type {import('cors').CorsOptions} */
  const corsOptions = {
    origin(origin, callback) {
      callback(null, matchOrigin(origin, runtimeOptions.allowedOrigins));
    },
  };
  uw.express.options('/api/*', cors(corsOptions));
  uw.express.use('/api', cors(corsOptions), uw.httpApi);
  // An older name
  uw.express.use('/v1', cors(corsOptions), uw.httpApi);

  uw.onClose(() => {
    unsubscribe();
    uw.server.close();
  });
}

/**
 * @param {import('./Uwave').Boot} uw
 */
async function errorHandling(uw) {
  uw.logger.debug({ ns: 'uwave:http-api' }, 'setup HTTP error handling');
  uw.httpApi.use(errorHandler({
    onError(_req, error) {
      uw.logger.error({ err: error, ns: 'uwave:http-api' });
    },
  }));
}

httpApi.errorHandling = errorHandling;

module.exports = httpApi;
