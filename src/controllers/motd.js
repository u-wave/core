import toItemResponse from '../utils/toItemResponse.js';

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
async function setMotd(req, res) {
  const { motd } = req.uwave;
  const { motd: newValue } = req.body;

  await motd.set(newValue);

  return getMotd(req, res);
}

export { getMotd, setMotd };
