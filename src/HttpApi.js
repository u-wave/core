import Router from 'router';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import url from 'url';

// routes
import authenticate from './routes/authenticate';
import bans from './routes/bans';
import search from './routes/search';
import users from './routes/users';
import now from './routes/now';
import imports from './routes/import';

// middleware
import addFullUrl from './middleware/addFullUrl';
import attachUwaveMeta from './middleware/attachUwaveMeta';
import errorHandler from './middleware/errorHandler';
import rateLimit from './middleware/rateLimit';

// utils
import AuthRegistry from './AuthRegistry';

function defaultCreatePasswordResetEmail({ token, requestUrl }) {
  const parsed = url.parse(requestUrl);
  const { hostname } = parsed;
  const webroot = url.format({
    ...parsed,
    pathname: '',
  });
  return {
    from: `noreply@${hostname}`,
    subject: 'üWave Password Reset Request',
    text: `
      Hello,

      To reset your password, please visit:
      ${webroot}/reset/${token}
    `,
  };
}

export default class UwaveHttpApi extends Router {
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
      .use('/users', users(this));

    this.use(errorHandler(options));

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
