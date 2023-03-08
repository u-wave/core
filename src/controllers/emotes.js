'use strict';

const toListResponse = require('../utils/toListResponse');

/**
 * @type {import('../types').Controller}
 */
async function getEmotes(req) {
  const { emotes } = req.uwave;

  if (!emotes) {
    return toListResponse([], { url: req.fullUrl });
  }

  const list = await emotes.getEmotes();

  return toListResponse(list, { url: req.fullUrl });
}

exports.getEmotes = getEmotes;
