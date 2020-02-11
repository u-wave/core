const toItemResponse = require('../utils/toItemResponse');

// eslint-disable-next-line import/prefer-default-export
function getServerTime(req) {
  return toItemResponse({
    time: Date.now(),
  }, { url: req.fullUrl });
}

exports.getServerTime = getServerTime;
