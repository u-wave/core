const { Passport } = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { callbackify } = require('util');
const debug = require('debug')('uwave:passport');
const JWTStrategy = require('../auth/JWTStrategy');

const AUTH_SETTINGS_KEY = 'u-wave:socialAuth';

const schema = {
  type: 'object',
  title: 'Social Login',
  description: 'Settings for third party login integrations like Google.',
  properties: {
    google: {
      type: 'object',
      title: 'Google Authentication',
      description: 'Settings for the Google authentication integration.',
      properties: {
        enabled: {
          type: 'boolean',
          title: 'Enabled',
          default: false,
        },
        clientID: {
          type: 'string',
          title: 'Client ID',
          description: 'The OAuth2 Client ID.',
        },
        clientSecret: {
          type: 'string',
          title: 'Client Secret',
          description: 'The secret key.',
        },
        callbackURL: {
          type: 'string',
          format: 'uri-reference',
          title: 'Callback URL',
          description: 'The URL that Google will redirect to once a signin is complete. This URL should contain the code that finalizes the login on the üWave end.',
        },
      },
      required: ['enabled'],
      // When enabled, clientID and clientSecret are required.
      dependencies: {
        enabled: ['clientID', 'clientSecret'],
      },
      default: {},
    },
  },
  required: ['google'],
};

class PassportPlugin extends Passport {
  constructor(uw, options) {
    super();

    this.uw = uw;
    this.socialLogin = this.socialLogin.bind(this);

    function serializeUser(user) {
      return Promise.resolve(user.id);
    }
    function deserializeUser(id) {
      return uw.users.getUser(id);
    }

    this.serializeUser(callbackify(serializeUser));
    this.deserializeUser(callbackify(deserializeUser));

    function localLogin(email, password) {
      return uw.users.login({ type: 'local', email, password });
    }

    this.use('local', new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password',
      session: false,
    }, callbackify(localLogin)));
    this.use('jwt', new JWTStrategy(options.secret, (user) => uw.users.getUser(user.id)));

    uw.config.register(AUTH_SETTINGS_KEY, schema);
    uw.config.on('set', (key, settings) => {
      if (key === AUTH_SETTINGS_KEY) {
        this.applyAuthStrategies(settings);
      }
    });

    uw.config.get(AUTH_SETTINGS_KEY)
      .then((settings) => this.applyAuthStrategies(settings))
      .catch((err) => {
        debug('social auth setup error', err);
      });
  }

  /**
   * @param {string} accessToken
   * @param {string} refreshToken
   * @param {{ provider: string }} profile
   * @returns {Promise<User>}
   * @private
   */
  socialLogin(accessToken, refreshToken, profile) {
    return this.uw.users.login({
      type: profile.provider,
      profile,
    });
  }

  supports(strategy) {
    return this._strategy(strategy) !== undefined; // eslint-disable-line no-underscore-dangle
  }

  strategies() {
    return Object.keys(this._strategies) // eslint-disable-line no-underscore-dangle
      .filter((strategy) => strategy !== 'session' && strategy !== 'jwt');
  }

  applyAuthStrategies(settings) {
    this.unuse('google');

    if (settings && settings.google && settings.google.enabled) {
      this.use('google', new GoogleStrategy({
        callbackURL: '/auth/service/google/callback',
        ...settings.google,
        scope: ['profile'],
      }, callbackify(this.socialLogin)));
    }
  }
}

function passportPlugin(options = {}) {
  return (uw) => {
    uw.passport = new PassportPlugin(uw, options);
  };
}

module.exports = passportPlugin;
