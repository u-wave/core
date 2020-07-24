const { Strategy } = require('passport');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const { PermissionError } = require('../errors');

const jwtVerify = promisify(jwt.verify);

function getCookieToken(cookies) {
  return cookies && cookies.uwsession;
}

function getQueryToken(query) {
  return query && query.token;
}

function getHeaderToken(headers) {
  if (headers.authorization) {
    const parts = headers.authorization.split(' ');
    if (parts[0].toLowerCase() === 'jwt') {
      return parts[1];
    }
  }
  return null;
}

class JWTStrategy extends Strategy {
  constructor(secret, getUser) {
    super();
    this.secret = secret;
    this.getUser = getUser;
  }

  authenticate(req, options) {
    this.authenticateP(req, options).catch((err) => {
      this.error(err);
    });
  }

  async authenticateP(req) {
    const token = getQueryToken(req.query)
      || getHeaderToken(req.headers)
      || getCookieToken(req.cookies);
    if (!token) {
      return this.pass();
    }

    let value;
    try {
      value = await jwtVerify(token, this.secret);
    } catch (e) {
      return this.pass();
    }

    if (!value) {
      return this.pass();
    }

    const user = await this.getUser(value);
    if (!user) {
      return this.pass();
    }

    if (user.pendingActivation) {
      req.pendingUser = user;
      return this.pass();
    }

    if (await user.isBanned()) {
      throw new PermissionError('You have been banned');
    }

    return this.success(user);
  }
}

module.exports = JWTStrategy;
