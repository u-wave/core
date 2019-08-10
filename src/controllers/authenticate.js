import { URLSearchParams } from 'url';
import cookie from 'cookie';
import createDebug from 'debug';
import jwt from 'jsonwebtoken';
import randomString from 'random-string';
import fetch from 'node-fetch';
import ms from 'ms';
import {
  HTTPError,
  PermissionError,
  TokenError,
  UserNotFoundError,
} from '../errors';
import sendEmail from '../email';
import beautifyDuplicateKeyError from '../utils/beautifyDuplicateKeyError';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';

const debug = createDebug('uwave:http:auth');

function seconds(str) {
  return Math.floor(ms(str) / 1000);
}

export function getCurrentUser(req) {
  return toItemResponse(req.user || {}, {
    url: req.fullUrl,
  });
}

export function getAuthStrategies(req) {
  const { passport } = req.uwave;

  const strategies = passport.strategies();

  return toListResponse(
    strategies,
    { url: req.fullUrl },
  );
}

export async function refreshSession(res, api, user, options) {
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
export async function login(options, req, res) {
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

export async function socialLoginCallback(options, service, req, res) {
  const { user } = req;

  if (await user.isBanned()) {
    throw new PermissionError('You have been banned.');
  }

  let script = '';
  if (user.pendingActivation) {
    script = `
      var opener = window.opener;
      if (opener) {
        opener.postMessage({
          pending: true,
          socialAvatar: ${JSON.stringify(user.avatar)},
          type: ${JSON.stringify(service)}
        }, '*');
      }
      window.close();
    `;
  } else {
    script = `
      var opener = window.opener;
      if (opener) {
        opener.postMessage({ pending: false }, '*');
      }
      window.close();
    `;
  }

  await refreshSession(res, req.uwaveHttp, user, {
    ...options,
    session: 'cookie',
  });

  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Success</title>
      </head>
      <body style="background: #151515; color: #fff; font: 12pt 'Open Sans', sans-serif">
        You can now close this window.
        <script>${script}</script>
      </body>
    </html>
  `);
}

export async function socialLoginFinish(options, service, req, res) {
  const { user } = req;
  const sessionType = req.query.session === 'cookie' ? 'cookie' : 'token';

  if (await user.isBanned()) {
    throw new PermissionError('You have been banned.');
  }

  const { username } = req.body;

  user.username = username;
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

export async function getSocketToken(req) {
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

export async function register(options, req) {
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

export async function reset(options, req) {
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

export async function changePassword(req) {
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

export async function logout(options, req, res) {
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

export async function removeSession() {
  throw new Error('Unimplemented');
}
