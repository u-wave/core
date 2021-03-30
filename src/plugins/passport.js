'use strict';

const { Passport } = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { callbackify } = require('util');
const debug = require('debug')('uwave:passport');
const JWTStrategy = require('../auth/JWTStrategy');

const schema = require('../schemas/socialAuth.json');

/**
 * @typedef {import('../models/User').User} User
 *
 * @typedef {{
 *   callbackURL?: string,
 * } & ({
 *   enabled: false,
 * } | {
 *   enabled: true,
 *   clientID: string,
 *   clientSecret: string,
 * })} GoogleOptions
 *
 * @typedef {object} SocialAuthOptions
 * @prop {GoogleOptions} google
 */

class PassportPlugin extends Passport {
  /**
   * @param {import('../Uwave')} uw
   * @param {{ secret: string }} options
   */
  constructor(uw, options) {
    super();

    this.uw = uw;
    this.socialLogin = this.socialLogin.bind(this);

    /**
     * @param {User} user
     * @returns {Promise<string>}
     */
    function serializeUser(user) {
      return Promise.resolve(user.id);
    }
    /**
     * @param {string} id
     * @returns {Promise<User>}
     */
    function deserializeUser(id) {
      return uw.users.getUser(id);
    }

    this.serializeUser(callbackify(serializeUser));
    this.deserializeUser(callbackify(deserializeUser));

    /**
     * @param {string} email
     * @param {string} password
     * @returns {Promise<User>}
     */
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
      if (key === schema['uw:key']) {
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
   * @param {import('passport').Profile} profile
   * @returns {Promise<User>}
   * @private
   */
  socialLogin(accessToken, refreshToken, profile) {
    return this.uw.users.login({
      type: profile.provider,
      profile,
    });
  }

  /**
   * @param {string} strategy
   * @returns {boolean}
   */
  supports(strategy) {
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    return this._strategy(strategy) !== undefined;
  }

  /**
   * @returns {string[]}
   */
  strategies() {
    // @ts-ignore
    // eslint-disable-next-line no-underscore-dangle
    return Object.keys(this._strategies)
      .filter((strategy) => strategy !== 'session' && strategy !== 'jwt');
  }

  /**
   * @param {SocialAuthOptions} settings
   */
  applyAuthStrategies(settings) {
    debug('reapplying settings');
    this.unuse('google');

    if (settings && settings.google && settings.google.enabled) {
      debug('enable google');
      this.use('google', new GoogleStrategy({
        callbackURL: '/auth/service/google/callback',
        ...settings.google,
        scope: ['profile'],
      }, callbackify(this.socialLogin)));
    }
  }
}

/**
 * @param {import('../Uwave')} uw
 * @param {{ secret: string }} options
 */
async function passportPlugin(uw, options) {
  debug('setup');
  uw.passport = new PassportPlugin(uw, options);
}

module.exports = passportPlugin;
module.exports.Passport = PassportPlugin;
