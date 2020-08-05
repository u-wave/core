const { Passport } = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { callbackify } = require('util');
const debug = require('debug')('uwave:passport');
const JWTStrategy = require('../auth/JWTStrategy');

const AUTH_SETTINGS_KEY = 'u-wave:socialAuth';

const schema = require('../schemas/socialAuth.json');

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

    uw.config.register(schema['uw:key'], schema);
    uw.config.on('set', (key, settings) => {
      if (key === AUTH_SETTINGS_KEY) {
        this.applyAuthStrategies(settings);
      }
    });

    uw.config.get(schema['uw:key'])
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
