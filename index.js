var UwaveServer = require('./lib/server').default;

module.exports = function uwave(opts) {
  return new UwaveServer(opts);
};

module.exports.Server = UwaveServer;
