'use strict';

const { URLSearchParams } = require('url');
const cookie = require('cookie');
const debug = require('debug')('uwave:http:auth');
const jwt = require('jsonwebtoken');
const randomString = require('random-string');
const fetch = require('node-fetch').default;
const ms = require('ms');
const htmlescape = require('htmlescape');
const { BadRequest } = require('http-errors');
const {
  BannedError,
  ReCaptchaError,
  InvalidResetTokenError,
  UserNotFoundError,
} = require('../errors');
const sendEmail = require('../email');
const beautifyDuplicateKeyError = require('../utils/beautifyDuplicateKeyError');
const toItemResponse = require('../utils/toItemResponse');
const toListResponse = require('../utils/toListResponse');

/**
 * @typedef {object} AuthenticateOptions
 * @prop {string|Buffer} secret
 * @prop {string} [origin]
 * @prop {import('nodemailer').Transport} [mailTransport]
 * @prop {{ secret: string }} [recaptcha]
 * @prop {(options: { token: string, requestUrl: string }) =>
 *   import('nodemailer').SendMailOptions} createPasswordResetEmail
 * @prop {boolean} [cookieSecure]
 * @prop {string} [cookiePath]
 */

/**
 * @param {string} str
 */
function seconds(str) {
  return Math.floor(ms(str) / 1000);
}

/**
 * @type {import('../types').Controller}
 */
async function getCurrentUser(req) {
  return toItemResponse(req.user || null, {
    url: req.fullUrl,
  });
}

/**
 * @type {import('../types').Controller}
 */
async function getAuthStrategies(req) {
  const { passport } = req.uwave;

  const strategies = passport.strategies();

  return toListResponse(
    strategies,
    { url: req.fullUrl },
  );
}

/**
 * @param {import('express').Response} res
 * @param {import('../HttpApi').HttpApi} api
 * @param {import('../models').User} user
 * @param {AuthenticateOptions & { session: 'cookie' | 'token' }} options
 */
async function refreshSession(res, api, user, options) {
  const token = jwt.sign(
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
 *
 * @type {import('../types').AuthenticatedController}
 */
async function login(req, res) {
  const options = req.authOptions;
  const { user } = req;
  const { session } = req.query;
  const { bans } = req.uwave;

  const sessionType = session === 'cookie' ? 'cookie' : 'token';

  if (await bans.isBanned(user)) {
    throw new BannedError();
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

/**
 * @param {string} service
 * @param {import('../types').AuthenticatedRequest} req
 * @param {import('express').Response} res
 */
async function socialLoginCallback(service, req, res) {
  const { user } = req;
  const { bans, locale } = req.uwave;
  const { origin } = req.authOptions;

  if (await bans.isBanned(user)) {
    throw new BannedError();
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
    ...req.authOptions,
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

/**
 * @typedef {object} SocialLoginFinishQuery
 * @prop {'cookie'|'token'} [session]
 *
 * @typedef {object} SocialLoginFinishBody
 * @prop {string} username
 * @prop {string} avatar
 */

/**
 * @param {string} service
 * @param {import('../types').Request<{}, SocialLoginFinishQuery, SocialLoginFinishBody>} req
 * @param {import('express').Response} res
 */
async function socialLoginFinish(service, req, res) {
  const options = req.authOptions;
  const { pendingUser: user } = req;
  const sessionType = req.query.session === 'cookie' ? 'cookie' : 'token';
  const { bans } = req.uwave;

  if (!user) {
    // Should never happen so not putting much effort into
    // localising the error message.
    throw new BadRequest('This account has already been set up');
  }

  if (await bans.isBanned(user)) {
    throw new BannedError();
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

/**
 * @type {import('../types').AuthenticatedController}
 */
async function getSocketToken(req) {
  const { user } = req;
  const { authRegistry } = req.uwaveHttp;

  const socketToken = await authRegistry.createAuthToken(user);

  return toItemResponse({ socketToken }, {
    url: req.fullUrl,
  });
}

/**
 * @param {string} responseString
 * @param {AuthenticateOptions} options
 */
async function verifyCaptcha(responseString, options) {
  if (!options.recaptcha) {
    debug('ReCaptcha validation is disabled');
    return null;
  }
  if (!responseString) {
    throw new ReCaptchaError();
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
    throw new ReCaptchaError();
  } else {
    debug('recaptcha: ok');
  }

  return null;
}

/**
 * @typedef {object} RegisterBody
 * @prop {string} email
 * @prop {string} username
 * @prop {string} password
 * @prop {string} [grecaptcha]
 */

/**
 * @type {import('../types').Controller<{}, {}, RegisterBody>}
 */
async function register(req) {
  const { users } = req.uwave;
  const {
    grecaptcha, email, username, password,
  } = req.body;

  try {
    await verifyCaptcha(grecaptcha, req.authOptions);

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

/**
 * @typedef {object} RequestPasswordResetBody
 * @prop {string} email
 */

/**
 * @type {import('../types').Controller<{}, {}, RequestPasswordResetBody>}
 */
async function reset(req) {
  const uw = req.uwave;
  const { Authentication } = uw.models;
  const { email } = req.body;
  const { mailTransport, createPasswordResetEmail } = req.authOptions;

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

/**
 * @typedef {object} ChangePasswordParams
 * @prop {string} reset
 *
 * @typedef {object} ChangePasswordBody
 * @prop {string} password
 */

/**
 * @type {import('../types').Controller<ChangePasswordParams, {}, ChangePasswordBody>}
 */
async function changePassword(req) {
  const { users, redis } = req.uwave;
  const { reset: resetToken } = req.params;
  const { password } = req.body;

  const userId = await redis.get(`reset:${resetToken}`);
  if (!userId) {
    throw new InvalidResetTokenError();
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

/**
 * @type {import('../types').AuthenticatedController}
 */
async function logout(req, res) {
  const { user, cookies } = req;
  const { cookieSecure, cookiePath } = req.authOptions;
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
