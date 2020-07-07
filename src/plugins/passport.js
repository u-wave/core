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

  function applyAuthStrategies(settings) {
    passport.unuse('google');

    if (settings && settings.google) {
      passport.use('google', new GoogleStrategy({
        callbackURL: '/auth/service/google/callback',
        ...settings.google,
        scope: ['profile'],
      }, callbackify(socialLogin)));
    }
  }

  uw.config.register(AUTH_SETTINGS_KEY, schema);
  uw.config.on('set', (key, settings) => {
    if (key === AUTH_SETTINGS_KEY) {
      applyAuthStrategies(settings);
    }
  });
  uw.config.get(AUTH_SETTINGS_KEY)
    .then(applyAuthStrategies)
    .catch((err) => {
      debug('social auth setup error', err);
    });

  return passport;
}

function passportPlugin(options = {}) {
  return (uw) => {
    uw.passport = configurePassport(uw, options);
  };
}

module.exports = passportPlugin;
