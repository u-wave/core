const { URLSearchParams } = require('url');
const cookie = require('cookie');
const createDebug = require('debug');
const jwt = require('jsonwebtoken');
const randomString = require('random-string');
const fetch = require('node-fetch');
const ms = require('ms');
const htmlescape = require('htmlescape');
const {
  HTTPError,
  PermissionError,
  TokenError,
  UserNotFoundError,
} = require('../errors');
const sendEmail = require('../email');
const beautifyDuplicateKeyError = require('../utils/beautifyDuplicateKeyError');
const toItemResponse = require('../utils/toItemResponse');
const toListResponse = require('../utils/toListResponse');

const debug = createDebug('uwave:http:auth');

function seconds(str) {
  return Math.floor(ms(str) / 1000);
}

function getCurrentUser(req) {
  return toItemResponse(req.user || {}, {
    url: req.fullUrl,
  });
}

function getAuthStrategies(req) {
  const { passport } = req.uwave;

  const strategies = passport.strategies();

  return toListResponse(
    strategies,
    { url: req.fullUrl },
  );
}

async function refreshSession(res, api, user, options) {
  const token = await jwt.sign(
    { id: user.id },
    options.secret,
    { expiresIn: '31d' },
  );

  const socketToken = await api.authRegistry.createAuthToken(user);

  if (options.session === 'cookie') {
    const serialized = cookie.serialize('uwsession', token, {
      httpOnly: true,
      secure: !!options.cookieSecure,
      path: options.cookiePath || '/',
      maxAge: seconds('31 days'),
    });
    res.setHeader('Set-Cookie', serialized);
    return { token: 'cookie', socketToken };
  }

  return { token, socketToken };
}

/**
 * The login controller is called once a user has logged in successfully using Passport;
 * we only have to assign the JWT.
 */
async function login(options, req, res) {
  const { user } = req;
  const { session } = req.query;

  const sessionType = session === 'cookie' ? 'cookie' : 'token';

  if (await user.isBanned()) {
    throw new PermissionError('You have been banned.');
  }

  const { token, socketToken } = await refreshSession(res, req.uwaveHttp, user, {
    ...options,
    session: sessionType,
  });

  return toItemResponse(user, {
    meta: {
      jwt: sessionType === 'token' ? token : 'cookie',
      socketToken,
    },
  });
}

async function getSocialAvatar(uw, user, service) {
  const Authentication = uw.model('Authentication');

  const auth = await Authentication.findOne({
    user,
    type: service,
  });
  if (auth && auth.avatar) {
    return auth.avatar;
  }
  return null;
}

async function socialLoginCallback(options, service, req, res) {
  const { user } = req;
  const { locale } = req.uwave;
  const { origin } = options;

  if (await user.isBanned()) {
    throw new PermissionError('You have been banned.');
  }

  let activationData = { pending: false };
  if (user.pendingActivation) {
    const socialAvatar = await getSocialAvatar(req.uwave, user, service);

    activationData = {
      pending: true,
      id: user.id,
      avatars: {
        sigil: `https://sigil.u-wave.net/${user.id}`,
      },
      type: service,
    };
    if (socialAvatar) {
      activationData.avatars[service] = socialAvatar;
    }
  }

  const script = `
    var opener = window.opener;
    if (opener) {
      opener.postMessage(${htmlescape(activationData)}, ${htmlescape(origin)});
    }
    window.close();
  `;

  await refreshSession(res, req.uwaveHttp, user, {
    ...options,
    session: 'cookie',
  });

  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${locale.t('authentication.successTitle')}</title>
      </head>
      <body style="background: #151515; color: #fff; font: 12pt 'Open Sans', sans-serif">
        ${locale.t('authentication.closeThisWindow')}
        <script>${script}</script>
      </body>
    </html>
  `);
}

async function socialLoginFinish(options, service, req, res) {
  const { pendingUser: user } = req;
  const sessionType = req.query.session === 'cookie' ? 'cookie' : 'token';

  if (!user) {
    throw new PermissionError('Must have a pending user account.');
  }

  if (await user.isBanned()) {
    throw new PermissionError('You have been banned.');
  }

  const { username, avatar } = req.body;

  // TODO Use the avatars plugin for this stuff later.
  let avatarUrl;
  if (avatar !== 'sigil') {
    avatarUrl = await getSocialAvatar(req.uwave, user, service);
  }
  if (!avatarUrl) {
    avatarUrl = `https://sigil.u-wave.net/${user.id}`;
  }

  user.username = username;
  user.avatar = avatarUrl;
  user.pendingActivation = undefined;
  await user.save();

  const { token, socketToken } = await refreshSession(res, req.uwaveHttp, user, {
    ...options,
    session: sessionType,
  });

  return toItemResponse(user, {
    meta: {
      jwt: sessionType === 'token' ? token : 'cookie',
      socketToken,
    },
  });
}

async function getSocketToken(req) {
  const { user } = req;
  const { authRegistry } = req.uwaveHttp;

  const socketToken = await authRegistry.createAuthToken(user);

  return toItemResponse({ socketToken }, {
    url: req.fullUrl,
  });
}

async function verifyCaptcha(responseString, options) {
  if (!options.recaptcha) {
    debug('ReCaptcha validation is disabled');
    return null;
  }
  if (!responseString) {
    throw new Error('ReCaptcha validation failed. Please try again.');
  }

  debug('recaptcha: sending siteverify request');
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'post',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams({
      response: responseString,
      secret: options.recaptcha.secret,
    }),
  });
  const body = await response.json();

  if (!body.success) {
    debug('recaptcha: validation failure', body);
    throw new Error('ReCaptcha validation failed. Please try again.');
  } else {
    debug('recaptcha: ok');
  }

  return null;
}

async function register(options, req) {
  const { users } = req.uwave;
  const {
    grecaptcha, email, username, password,
  } = req.body;

  if (/\s/.test(username)) {
    throw new HTTPError(400, 'Usernames can\'t contain spaces.');
  }

  try {
    await verifyCaptcha(grecaptcha, options);

    const user = await users.createUser({
      email,
      username,
      password,
    });

    return toItemResponse(user);
  } catch (error) {
    throw beautifyDuplicateKeyError(error);
  }
}

async function reset(options, req) {
  const uw = req.uwave;
  const { Authentication } = uw.models;
  const { email } = req.body;
  const { mailTransport, createPasswordResetEmail } = options;

  const auth = await Authentication.findOne({
    email: email.toLowerCase(),
  });
  if (!auth) {
    throw new UserNotFoundError({ email });
  }

  const token = randomString({ length: 35, special: false });

  await uw.redis.set(`reset:${token}`, auth.user.toString());
  await uw.redis.expire(`reset:${token}`, 24 * 60 * 60);

  const message = await createPasswordResetEmail({
    token,
    requestUrl: req.fullUrl,
  });

  await sendEmail(email, {
    mailTransport,
    email: message,
  });

  return toItemResponse({});
}

async function changePassword(req) {
  const { users, redis } = req.uwave;
  const { reset: resetToken } = req.params;
  const { password } = req.body;

  const userId = await redis.get(`reset:${resetToken}`);
  if (!userId) {
    throw new TokenError('That reset token is invalid. Please double-check your reset '
      + 'token or request a new password reset.');
  }

  const user = await users.getUser(userId);
  if (!user) {
    throw new UserNotFoundError({ id: userId });
  }

  await users.updatePassword(user.id, password);

  await redis.del(`reset:${resetToken}`);

  return toItemResponse({}, {
    meta: {
      message: `Updated password for ${user.username}`,
    },
  });
}

async function logout(options, req, res) {
  const { user, cookies } = req;
  const { cookieSecure, cookiePath } = options;
  const uw = req.uwave;

  uw.publish('user:logout', {
    userID: user.id,
  });

  if (cookies && cookies.uwsession) {
    const serialized = cookie.serialize('uwsession', '', {
      httpOnly: true,
      secure: !!cookieSecure,
      path: cookiePath || '/',
      maxAge: 0,
    });
    res.setHeader('Set-Cookie', serialized);
  }

  return toItemResponse({});
}

async function removeSession() {
  throw new Error('Unimplemented');
}

exports.changePassword = changePassword;
exports.getAuthStrategies = getAuthStrategies;
exports.getCurrentUser = getCurrentUser;
exports.getSocketToken = getSocketToken;
exports.login = login;
exports.logout = logout;
exports.refreshSession = refreshSession;
exports.register = register;
exports.removeSession = removeSession;
exports.reset = reset;
exports.socialLoginCallback = socialLoginCallback;
exports.socialLoginFinish = socialLoginFinish;
