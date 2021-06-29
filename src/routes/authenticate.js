'use strict';

const { Router } = require('express');
const route = require('../route');
const validations = require('../validations');
const protect = require('../middleware/protect');
const schema = require('../middleware/schema');
const controller = require('../controllers/authenticate');

/**
 * @param {import('../controllers/authenticate').AuthenticateOptions} options
 * @returns {import('express').RequestHandler}
 */
function withOptions(options) {
  return (req, res, next) => {
    req.authOptions = options;
    next();
  };
}

/**
 * @param {import('passport').Authenticator} passport
 * @param {import('../controllers/authenticate').AuthenticateOptions} options
 */
function authenticateRoutes(passport, options) {
  const auth = Router()
    // GET /auth/ - Show current user information.
    .get(
      '/',
      route(controller.getCurrentUser),
    )
    // GET /auth/strategies - Show available authentication strategies.
    .get(
      '/strategies',
      route(controller.getAuthStrategies),
    )
    // POST /auth/register - Create a new user account.
    .post(
      '/register',
      schema(validations.register),
      withOptions(options),
      route(controller.register),
    )
    // POST /auth/login - Log in as an existing user.
    .post(
      '/login',
      schema(validations.login),
      passport.authenticate('local', { failWithError: true }),
      withOptions(options),
      route(controller.login),
    )
    // GET /auth/socket - Obtain an authentication token for the WebSocket server.
    .get(
      '/socket',
      protect(),
      route(controller.getSocketToken),
    )
    // DELETE /auth/ - Log out (delete the session).
    .delete(
      '/',
      protect(),
      withOptions(options),
      route(controller.logout),
    )
    // POST /auth/password/reset - Request a password reset.
    .post(
      '/password/reset',
      schema(validations.requestPasswordReset),
      withOptions(options),
      route(controller.reset),
    )
    // POST /auth/password/reset/:reset - Change the password using a reset token.
    .post(
      '/password/reset/:reset',
      schema(validations.passwordReset),
      route(controller.changePassword),
    )
    // DELETE /auth/session/:id - Unused? Forcibly quit a user's session.
    .delete(
      '/session/:id',
      route(controller.removeSession),
    )
    // GET /auth/service/google - Initiate a social login using Google.
    .get(
      '/service/google',
      passport.authenticate('google'),
      withOptions(options),
      route(controller.login),
    )
    // GET /auth/service/google/callback - Finish a social login using Google.
    .get(
      '/service/google/callback',
      passport.authenticate('google'),
      withOptions(options),
      route(controller.socialLoginCallback.bind(null, 'google')),
    )
    // GET /auth/service/google - Initiate a social login using Google.
    .get(
      '/service/google',
      passport.authenticate('google'),
      withOptions(options),
      route(controller.login),
    )
    // GET /auth/service/google/callback - Receive social login data from Google.
    .get(
      '/service/google/callback',
      passport.authenticate('google'),
      withOptions(options),
      route(controller.socialLoginCallback.bind(null, 'google')),
    )
    // POST /auth/service/google/finish - Finish creating an account with Google.
    .post(
      '/service/google/finish',
      withOptions(options),
      route(controller.socialLoginFinish.bind(null, 'google')),
    );

  return auth;
}

module.exports = authenticateRoutes;
