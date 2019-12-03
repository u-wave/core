import props from 'p-props';
import {
  CombinedError,
  HTTPError,
  NotFoundError,
  PermissionError,
  HistoryEntryNotFoundError,
  PlaylistNotFoundError,
  CannotSelfFavoriteError,
} from '../errors';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';
import toPaginatedResponse from '../utils/toPaginatedResponse';

export async function getBoothData(uw) {
  const { booth, redis } = uw;

  const historyEntry = await booth.getCurrentEntry();

  if (!historyEntry || !historyEntry.user) {
    return null;
  }

  await historyEntry.populate('media.media').execPopulate();

  const stats = await props({
    upvotes: redis.smembers('booth:upvotes'),
    downvotes: redis.smembers('booth:downvotes'),
    favorites: redis.smembers('booth:favorites'),
  });

  return {
    historyID: historyEntry.id,
    playlistID: `${historyEntry.playlist}`,
    playedAt: Date.parse(historyEntry.playedAt),
    userID: `${historyEntry.user}`,
    media: historyEntry.media,
    stats,
  };
}
export async function getBooth(req) {
  const uw = req.uwave;

  const data = await getBoothData(uw);

  return toItemResponse(data, { url: req.fullUrl });
}

function getCurrentDJ(uw) {
  return uw.redis.get('booth:currentDJ');
}

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

export async function skipBooth(req) {
  const { user } = req;
  const { userID, reason, remove } = req.body;

  const skippingSelf = (!userID && !reason)
    || userID === user.id;
  const opts = { remove: !!remove };

  if (skippingSelf) {
    const currentDJ = await getCurrentDJ(req.uwave);
    if (!currentDJ || currentDJ !== req.user.id) {
      throw new HTTPError(412, 'You are not currently playing');
    }

    await doSkip(req.uwave, null, req.user.id, null, opts);

    return toItemResponse({});
  }

  const errors = [];
  if (!await user.can('booth.skip.other')) {
    errors.push(new PermissionError('You need to be a moderator to do this'));
  }
  if (typeof userID !== 'string') {
    errors.push(new HTTPError(422, 'userID: Expected a string'));
  }
  if (typeof reason !== 'string') {
    errors.push(new HTTPError(422, 'reason: Expected a string'));
  }
  if (errors.length > 0) {
    throw new CombinedError(errors);
  }

  await doSkip(req.uwave, user.id, userID, reason, opts);

  return toItemResponse({});
}

export async function replaceBooth(req) {
  const uw = req.uwave;
  const moderatorID = req.user.id;
  const { userID } = req.body;
  let waitlist = await uw.redis.lrange('waitlist', 0, -1);

  if (!waitlist.length) {
    throw new NotFoundError('Waitlist is empty.');
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

async function addVote(uw, userID, direction) {
  await uw.redis.multi()
    .srem('booth:upvotes', userID)
    .srem('booth:downvotes', userID)
    .sadd(direction > 0 ? 'booth:upvotes' : 'booth:downvotes', userID)
    .exec();
  uw.publish('booth:vote', {
    userID, direction,
  });
}

// Old way of voting: over the WebSocket
export async function socketVote(uw, userID, direction) {
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

export async function getVote(req) {
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
    uw.redis.sismember('booth:upvotes'),
    uw.redis.sismember('booth:downvotes'),
  ]);

  let direction = 0;
  if (upvoted) {
    direction = 1;
  } else if (downvoted) {
    direction = -1;
  }

  return toItemResponse({ direction });
}
export async function vote(req) {
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
    throw new HTTPError(412, 'Cannot vote for your own plays')
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

export async function favorite(req) {
  const { user } = req;
  const { playlistID, historyID } = req.body;
  const uw = req.uwave;
  const { PlaylistItem, HistoryEntry } = uw.models;

  const historyEntry = await HistoryEntry.findById(historyID)
    .populate('media.media');

  if (!historyEntry) {
    throw new HistoryEntryNotFoundError({ id: historyID });
  }
  if (`${historyEntry.user}` === user.id) {
    throw new CannotSelfFavoriteError();
  }

  const playlist = await user.getPlaylist(playlistID);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id: playlistID });
  }

  // `.media` has the same shape as `.item`, but is guaranteed to exist and have
  // the same properties as when the playlist item was actually played.
  const playlistItem = new PlaylistItem(historyEntry.media.toJSON());

  await playlistItem.save();

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

export async function getHistory(req) {
  const pagination = getOffsetPagination(req.query, {
    defaultSize: 25,
    maxSize: 100,
  });
  const { history } = req.uwave;

  const roomHistory = await history.getRoomHistory(pagination);

  return toPaginatedResponse(roomHistory, {
    baseUrl: req.fullUrl,
    included: {
      media: ['media.media'],
      user: ['user'],
    },
  });
}
