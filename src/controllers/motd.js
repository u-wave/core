const toItemResponse = require('../utils/toItemResponse');

async function getMotd(req) {
  const { motd } = req.uwave;

  const value = await motd.get();

  return toItemResponse(
    { motd: value },
    { url: req.fullUrl },
  );
}

async function setMotd(req, ...args) {
  const { motd } = req.uwave;
  const { motd: newValue } = req.body;

  await motd.set(String(newValue));

  return getMotd(req, ...args);
}

exports.getMotd = getMotd;
exports.setMotd = setMotd;
