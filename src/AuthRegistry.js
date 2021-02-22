'use strict';

const crypto = require('crypto');
const { promisify } = require('util');

const randomBytes = promisify(crypto.randomBytes);

class AuthRegistry {
  constructor(redis) {
    this.redis = redis;
  }

  async createAuthToken(user) {
    const token = (await randomBytes(64)).toString('hex');
    await this.redis.set(`http-api:socketAuth:${token}`, user.id, 'EX', 60);
    return token;
  }

  async getTokenUser(token) {
    if (token.length !== 128) {
      throw new Error('Invalid token');
    }
    const [result] = await this.redis
      .multi()
      .get(`http-api:socketAuth:${token}`)
      .del(`http-api:socketAuth:${token}`)
      .exec();

    const [err, userID] = result;
    if (err) {
      throw err;
    }

    return userID;
  }
}

module.exports = AuthRegistry;
