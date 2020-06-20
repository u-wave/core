const { Passport } = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { callbackify } = require('util');
const JWTStrategy = require('../auth/JWTStrategy');

class PassportPlugin extends Passport {
  constructor(uw, options) {
    super();

    function localLogin(email, password) {
      return uw.users.login({ type: 'local', email, password });
    }

    function socialLogin(accessToken, refreshToken, profile) {
      return uw.users.login({
        type: profile.provider,
        profile,
      });
    }

    function googleLogin(accessToken, refreshToken, profile) {
      return socialLogin(accessToken, refreshToken, {
        provider: 'google',
        id: profile.id,
        photos: profile.photos,
      });
    }

    function serializeUser(user) {
      return Promise.resolve(user.id);
    }
    function deserializeUser(id) {
      return uw.users.getUser(id);
    }

    this.use('local', new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password',
      session: false,
    }, callbackify(localLogin)));

    if (options.auth && options.auth.google) {
      this.use('google', new GoogleStrategy({
        callbackURL: '/auth/service/google/callback',
        ...options.auth.google,
        scope: ['profile'],
      }, callbackify(googleLogin)));
    }

    this.use('jwt', new JWTStrategy(options.secret, (user) => uw.users.getUser(user.id)));
    this.serializeUser(callbackify(serializeUser));
    this.deserializeUser(callbackify(deserializeUser));
  }

  supports(strategy) {
    return this._strategy(strategy) !== undefined; // eslint-disable-line no-underscore-dangle
  }

  strategies() {
    return Object.keys(this._strategies) // eslint-disable-line no-underscore-dangle
      .filter((strategy) => strategy !== 'session' && strategy !== 'jwt');
  }
}

function passportPlugin(options = {}) {
  return (uw) => {
    uw.passport = new PassportPlugin(uw, options);
  };
}

module.exports = passportPlugin;
