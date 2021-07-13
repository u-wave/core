'use strict';

const has = require('has');
const { Strategy } = require('passport');
const jwt = require('jsonwebtoken');
const { BannedError } = require('../errors');

/**
 * @typedef {import('../models').User} User
 */

/**
 * @param {Record<string, string>} cookies
 */
function getCookieToken(cookies) {
  return cookies && cookies.uwsession;
}

/**
 * @param {import('qs').ParsedQs} query
 */
function getQueryToken(query) {
  return query && typeof query.token === 'string' ? query.token : null;
}

/**
 * @param {import('http').IncomingHttpHeaders} headers
 */
function getHeaderToken(headers) {
  if (headers.authorization) {
    const parts = headers.authorization.split(' ');
    if (parts[0].toLowerCase() === 'jwt') {
      return parts[1];
    }
  }
  return null;
}

/**
 * @param {unknown} obj
 * @returns {obj is { id: string }}
 */
function isUserIDToken(obj) {
  return typeof obj === 'object'
    && obj !== null
    && has(obj, 'id')
    && typeof obj.id === 'string';
}

class JWTStrategy extends Strategy {
  /**
   * @param {Buffer|string} secret
   * @param {(claim: { id: string }) => Promise<User>} getUser
   */
  constructor(secret, getUser) {
    super();
    this.secret = secret;
    this.getUser = getUser;
  }

  /**
   * @param {import('express').Request} req
   */
  authenticate(req) {
    this.authenticateP(req).catch((err) => {
      this.error(err);
    });
  }

  /**
   * @param {import('express').Request} req
   */
  async authenticateP(req) {
    const { bans } = req.uwave;

    const token = getQueryToken(req.query)
      || getHeaderToken(req.headers)
      || getCookieToken(req.cookies);
    if (!token) {
      return this.pass();
    }

    /** @type {unknown} */
    let value;
    try {
      value = jwt.verify(token, this.secret);
    } catch (e) {
      return this.pass();
    }

    if (!isUserIDToken(value)) {
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

    if (await bans.isBanned(user)) {
      throw new BannedError();
    }

    return this.success(user);
  }
}

module.exports = JWTStrategy;
