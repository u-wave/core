'use strict';

const toItemResponse = require('../utils/toItemResponse');

/**
 * @type {import('../types').Controller<{}, {}, {}>}
 */
async function getMotd(req) {
  const { motd } = req.uwave;

  const value = await motd.get();

  return toItemResponse(
    { motd: value },
    { url: req.fullUrl },
  );
}

/**
 * @type {import('../types').AuthenticatedController<{}, {}, { motd: string | null }>}
 */
async function setMotd(req) {
  const { motd } = req.uwave;
  const { motd: newValue } = req.body;

  await motd.set(newValue);

  return getMotd(req);
}

exports.getMotd = getMotd;
exports.setMotd = setMotd;
