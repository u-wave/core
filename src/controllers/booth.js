'use strict';

const mongoose = require('mongoose');
const {
  HTTPError,
  PermissionError,
  HistoryEntryNotFoundError,
  PlaylistNotFoundError,
  CannotSelfFavoriteError,
} = require('../errors');
const getOffsetPagination = require('../utils/getOffsetPagination');
const toItemResponse = require('../utils/toItemResponse');
const toListResponse = require('../utils/toListResponse');
const toPaginatedResponse = require('../utils/toPaginatedResponse');

const { ObjectId } = mongoose.Types;

/**
 * @param {import('../Uwave')} uw
 */
async function getBoothData(uw) {
  const { booth } = uw;

  const historyEntry = await booth.getCurrentEntry();

  if (!historyEntry || !historyEntry.user) {
    return null;
  }

  await historyEntry.populate('media.media');
  // @ts-ignore TS2322: We just populated historyEntry.media.media
  const media = booth.getMediaForPlayback(historyEntry);

  const stats = await booth.getCurrentVoteStats();

  return {
    historyID: historyEntry.id,
    playlistID: `${historyEntry.playlist}`,
    playedAt: historyEntry.playedAt.getTime(),
    userID: `${historyEntry.user}`,
    media,
    stats,
  };
}

/**
 * @type {import('../types').Controller}
 */
async function getBooth(req) {
  const uw = req.uwave;

  const data = await getBoothData(uw);

  return toItemResponse(data, { url: req.fullUrl });
}

/**
 * @param {import('../Uwave')} uw
 * @returns {Promise<string|null>}
 */
function getCurrentDJ(uw) {
  return uw.redis.get('booth:currentDJ');
}

/**
 * @param {import('../Uwave')} uw
 * @param {string|null} moderatorID - `null` if a user is skipping their own turn.
 * @param {string} userID
 * @param {string|null} reason
 * @param {{ remove?: boolean }} [opts]
 */
async function doSkip(uw, moderatorID, userID, reason, opts = {}) {
  uw.publish('booth:skip', {
    moderatorID,
    userID,
    reason,
  });

  await uw.booth.advance({
    remove: opts.remove === true,
  });
}

/**
 * @typedef {object} SkipUserAndReason
 * @prop {string} userID
 * @prop {string} reason
 *
 * @typedef {{
 *   remove?: boolean,
 *   userID?: undefined,
 *   reason?: undefined,
 * } & (SkipUserAndReason | {})} SkipBoothBody
 */

/**
 * @type {import('../types').AuthenticatedController<{}, {}, SkipBoothBody>}
 */
async function skipBooth(req) {
  const { user } = req;
  const { userID, reason, remove } = req.body;
  const { acl } = req.uwave;

  const skippingSelf = (!userID && !reason) || userID === user.id;
  const opts = { remove: !!remove };

  if (skippingSelf) {
    const currentDJ = await getCurrentDJ(req.uwave);
    if (!currentDJ || currentDJ !== req.user.id) {
      throw new HTTPError(412, 'You are not currently playing');
    }

    await doSkip(req.uwave, null, req.user.id, null, opts);

    return toItemResponse({});
  }

  if (!await acl.isAllowed(user, 'booth.skip.other')) {
    throw new PermissionError({ requiredRole: 'booth.skip.other' });
  }

  // @ts-ignore pretending like `userID` is definitely defined here
  // TODO I think the typescript error is actually correct so we should fix this
  await doSkip(req.uwave, user.id, userID, reason, opts);

  return toItemResponse({});
}

/**
 * @typedef {object} ReplaceBoothBody
 * @prop {string} userID
 */

/**
 * @type {import('../types').AuthenticatedController<{}, {}, ReplaceBoothBody>}
 */
async function replaceBooth(req) {
  const uw = req.uwave;
  const moderatorID = req.user.id;
  const { userID } = req.body;
  let waitlist = await uw.redis.lrange('waitlist', 0, -1);

  if (!waitlist.length) {
    throw new HTTPError(404, 'Waitlist is empty.');
  }

  if (waitlist.includes(userID)) {
    uw.redis.lrem('waitlist', 1, userID);
    await uw.redis.lpush('waitlist', userID);
    waitlist = await uw.redis.lrange('waitlist', 0, -1);
  }

  uw.publish('booth:replace', {
    moderatorID,
    userID,
  });

  await uw.booth.advance();

  return toItemResponse({});
}

/**
 * @param {import('../Uwave')} uw
 * @param {string} userID
 * @param {1|-1} direction
 */
async function addVote(uw, userID, direction) {
  const results = await uw.redis.multi()
    .srem('booth:upvotes', userID)
    .srem('booth:downvotes', userID)
    .sadd(direction > 0 ? 'booth:upvotes' : 'booth:downvotes', userID)
    .exec();
  const replacedUpvote = results[0][1] !== 0;
  const replacedDownvote = results[1][1] !== 0;

  // Replaced an upvote by an upvote or a downvote by a downvote: the vote didn't change.
  // We don't need to broadcast the non-change to everyone.
  if ((replacedUpvote && direction > 0) || (replacedDownvote && direction < 0)) {
    return;
  }

  uw.publish('booth:vote', {
    userID, direction,
  });
}

/**
 * Old way of voting: over the WebSocket
 *
 * @param {import('../Uwave')} uw
 * @param {string} userID
 * @param {1|-1} direction
 */
async function socketVote(uw, userID, direction) {
  const currentDJ = await getCurrentDJ(uw);
  if (currentDJ !== null && currentDJ !== userID) {
    const historyID = await uw.redis.get('booth:historyID');
    if (historyID === null) return;
    if (direction > 0) {
      await addVote(uw, userID, 1);
    } else {
      await addVote(uw, userID, -1);
    }
  }
}

/**
 * @typedef {object} GetVoteParams
 * @prop {string} historyID
 */

/**
 * @type {import('../types').AuthenticatedController<GetVoteParams>}
 */
async function getVote(req) {
  const { uwave: uw, user } = req;
  const { historyID } = req.params;

  const [currentDJ, currentHistoryID] = await Promise.all([
    getCurrentDJ(uw),
    uw.redis.get('booth:historyID'),
  ]);
  if (currentDJ === null || currentHistoryID === null) {
    throw new HTTPError(412, 'Nobody is playing');
  }
  if (historyID && historyID !== currentHistoryID) {
    throw new HTTPError(412, 'Cannot get vote for media that is not currently playing');
  }

  const [upvoted, downvoted] = await Promise.all([
    uw.redis.sismember('booth:upvotes', user.id),
    uw.redis.sismember('booth:downvotes', user.id),
  ]);

  let direction = 0;
  if (upvoted) {
    direction = 1;
  } else if (downvoted) {
    direction = -1;
  }

  return toItemResponse({ direction });
}

/**
 * @typedef {object} VoteParams
 * @prop {string} historyID
 *
 * @typedef {object} VoteBody
 * @prop {1|-1} direction
 */

/**
 * @type {import('../types').AuthenticatedController<VoteParams, {}, VoteBody>}
 */
async function vote(req) {
  const { uwave: uw, user } = req;
  const { historyID } = req.params;
  const { direction } = req.body;

  const [currentDJ, currentHistoryID] = await Promise.all([
    getCurrentDJ(uw),
    uw.redis.get('booth:historyID'),
  ]);
  if (currentDJ === null || currentHistoryID === null) {
    throw new HTTPError(412, 'Nobody is playing');
  }
  if (currentDJ === user.id) {
    throw new HTTPError(412, 'Cannot vote for your own plays');
  }
  if (historyID && historyID !== currentHistoryID) {
    throw new HTTPError(412, 'Cannot vote for media that is not currently playing');
  }

  if (direction > 0) {
    await addVote(uw, user.id, 1);
  } else {
    await addVote(uw, user.id, -1);
  }

  return toItemResponse({});
}

/**
 * @typedef {object} FavoriteBody
 * @prop {string} playlistID
 * @prop {string} historyID
 */

/**
 * @type {import('../types').AuthenticatedController<{}, {}, FavoriteBody>}
 */
async function favorite(req) {
  const { user } = req;
  const { playlistID, historyID } = req.body;
  const uw = req.uwave;
  const { PlaylistItem, HistoryEntry } = uw.models;

  const historyEntry = await HistoryEntry.findById(historyID);

  if (!historyEntry) {
    throw new HistoryEntryNotFoundError({ id: historyID });
  }
  if (`${historyEntry.user}` === user.id) {
    throw new CannotSelfFavoriteError();
  }

  const playlist = await uw.playlists.getUserPlaylist(user, new ObjectId(playlistID));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id: playlistID });
  }

  // `.media` has the same shape as `.item`, but is guaranteed to exist and have
  // the same properties as when the playlist item was actually played.
  const playlistItem = await PlaylistItem.create(historyEntry.media.toJSON());

  playlist.media.push(playlistItem.id);

  await uw.redis.sadd('booth:favorites', user.id);
  uw.publish('booth:favorite', {
    userID: user.id,
    playlistID,
  });

  await playlist.save();

  return toListResponse([playlistItem], {
    meta: {
      playlistSize: playlist.media.length,
    },
    included: {
      media: ['media'],
    },
  });
}

/**
 * @type {import('../types').Controller}
 */
async function getHistory(req) {
  const filter = {};
  const pagination = getOffsetPagination(req.query, {
    defaultSize: 25,
    maxSize: 100,
  });
  const { history } = req.uwave;

  if (req.query.filter && req.query.filter.media) {
    filter['media.media'] = req.query.filter.media;
  }

  const roomHistory = await history.getHistory(filter, pagination);

  return toPaginatedResponse(roomHistory, {
    baseUrl: req.fullUrl,
    included: {
      media: ['media.media'],
      user: ['user'],
    },
  });
}

exports.favorite = favorite;
exports.getBooth = getBooth;
exports.getBoothData = getBoothData;
exports.getHistory = getHistory;
exports.getVote = getVote;
exports.replaceBooth = replaceBooth;
exports.skipBooth = skipBooth;
exports.socketVote = socketVote;
exports.vote = vote;
