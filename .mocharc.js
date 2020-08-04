const ms = require('ms');

module.exports = {
  timeout: ms('30 seconds'),
  recursive: 'test/',
  require: 'make-promises-safe',
};
