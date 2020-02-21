const { Passport } = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { callbackify } = require('util');
const JWTStrategy = require('../auth/JWTStrategy');

function configurePassport(uw, options) {
  const passport = new Passport();

  async function localLogin(email, password) {
    return uw.users.login({ type: 'local', email, password });
  }

  async function socialLogin(accessToken, refreshToken, profile) {
    return uw.users.login({
      type: profile.provider,
      profile,
    });
  }

  async function serializeUser(user) {
    return user.id;
  }
  async function deserializeUser(id) {
    return uw.users.getUser(id);
  }

  passport.use('local', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    session: false,
  }, callbackify(localLogin)));

  if (options.auth && options.auth.google) {
    passport.use('google', new GoogleStrategy({
      callbackURL: '/auth/service/google/callback',
      ...options.auth.google,
      scope: ['profile'],
    }, callbackify(socialLogin)));
  }

  passport.use('jwt', new JWTStrategy(options.secret, (user) => uw.users.getUser(user.id)));
  passport.serializeUser(callbackify(serializeUser));
  passport.deserializeUser(callbackify(deserializeUser));

  passport.supports = (strategy) => (
    passport._strategy(strategy) !== undefined // eslint-disable-line no-underscore-dangle
  );
  passport.strategies = () => (
    Object.keys(passport._strategies) // eslint-disable-line no-underscore-dangle
      .filter((strategy) => strategy !== 'session' && strategy !== 'jwt')
  );

  return passport;
}

function passportPlugin(options = {}) {
  return (uw) => {
    uw.passport = configurePassport(uw, options);
  };
}

module.exports = passportPlugin;
