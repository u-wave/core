const { PermissionError } = require('../errors');
const wrapMiddleware = require('../utils/wrapMiddleware');

function requireActiveConnection() {
  async function isConnected(uwave, user) {
    const onlineIDs = await uwave.redis.lrange('users', 0, -1);
    return onlineIDs.indexOf(user.id) !== -1;
  }

  return wrapMiddleware(async (req) => {
    const connected = await isConnected(req.uwave, req.user);
    if (!connected) {
      throw new PermissionError('You need to be logged in and connected to do this.');
    }
  });
}

module.exports = requireActiveConnection;
