'use strict';

const { BadRequest } = require('http-errors');
const wrapMiddleware = require('../utils/wrapMiddleware');

function requireActiveConnection() {
  /**
   * @param {import('../Uwave')} uwave
   * @param {import('../models').User} user
   */
  async function isConnected(uwave, user) {
    const onlineIDs = await uwave.redis.lrange('users', 0, -1);
    return onlineIDs.indexOf(user.id) !== -1;
  }

  return wrapMiddleware(async (req) => {
    const connected = req.user && await isConnected(req.uwave, req.user);
    if (!connected) {
      throw new BadRequest('You need to be logged in and connected to do this.');
    }
  });
}

module.exports = requireActiveConnection;
