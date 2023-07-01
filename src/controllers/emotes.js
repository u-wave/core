import toListResponse from '../utils/toListResponse.js';

/**
 * @type {import('../types.js').Controller}
 */
async function getEmotes(req) {
  const { emotes } = req.uwave;

  if (!emotes) {
    return toListResponse([], { url: req.fullUrl });
  }

  const list = await emotes.getEmotes();

  return toListResponse(list, { url: req.fullUrl });
}

export { getEmotes };
