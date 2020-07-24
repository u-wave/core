const router = require('router');
const route = require('../route');
const validations = require('../validations');
const protect = require('../middleware/protect');
const checkFields = require('../middleware/checkFields');
const controller = require('../controllers/authenticate');

function authenticateRoutes(api, options) {
  const { passport } = api.uw;

  const auth = router()
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
      checkFields(validations.register),
      route(controller.register.bind(null, options)),
    )
    // POST /auth/login - Log in as an existing user.
    .post(
      '/login',
      checkFields(validations.login),
      passport.authenticate('local', { failWithError: true }),
      route(controller.login.bind(null, options)),
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
      route(controller.logout.bind(null, options)),
    )
    // POST /auth/password/reset - Request a password reset.
    .post(
      '/password/reset',
      checkFields(validations.requestPasswordReset),
      route(controller.reset.bind(null, options)),
    )
    // POST /auth/password/reset/:reset - Change the password using a reset token.
    .post(
      '/password/reset/:reset',
      checkFields(validations.passwordReset),
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
      route(controller.login.bind(null, options)),
    )
    // GET /auth/service/google/callback - Finish a social login using Google.
    .get(
      '/service/google/callback',
      passport.authenticate('google'),
      route(controller.socialLoginCallback.bind(null, options)),
    )
    // GET /auth/service/google - Initiate a social login using Google.
    .get(
      '/service/google',
      passport.authenticate('google'),
      route(controller.login.bind(null, options, 'google')),
    )
    // GET /auth/service/google/callback - Receive social login data from Google.
    .get(
      '/service/google/callback',
      passport.authenticate('google'),
      route(controller.socialLoginCallback.bind(null, options, 'google')),
    )
    // POST /auth/service/google/finish - Finish creating an account with Google.
    .post(
      '/service/google/finish',
      route(controller.socialLoginFinish.bind(null, options, 'google')),
    );

  return auth;
}

module.exports = authenticateRoutes;
