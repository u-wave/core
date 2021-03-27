'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const {
  HTTPError,
  PlaylistNotFoundError,
  PlaylistItemNotFoundError,
} = require('../errors');
const { serializePlaylist } = require('../utils/serialize');
const getOffsetPagination = require('../utils/getOffsetPagination');
const toItemResponse = require('../utils/toItemResponse');
const toListResponse = require('../utils/toListResponse');
const toPaginatedResponse = require('../utils/toPaginatedResponse');

const { ObjectId } = mongoose.Types;

/**
 * @type {import('../types').Controller}
 */
async function getPlaylists(req) {
  const { user } = req;
  const uw = req.uwave;
  const { contains } = req.query;

  assert(typeof contains === 'string', 'checked by ajv');

  let playlists;
  if (contains) {
    playlists = await uw.playlists.getPlaylistsContainingMedia(contains, { author: user._id });
  } else {
    playlists = await uw.playlists.getUserPlaylists(user);
  }

  return toListResponse(
    playlists.map(serializePlaylist),
    { url: req.fullUrl },
  );
}

/**
 * @type {import('../types').Controller}
 */
async function getPlaylist(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));

  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

/**
 * @type {import('../types').Controller}
 */
async function createPlaylist(req) {
  const { user } = req;
  const { name } = req.body;
  const { playlists } = req.uwave;

  const playlist = await playlists.createPlaylist(user, {
    name,
  });

  const activeID = user.activePlaylist.toString();

  return toItemResponse(
    serializePlaylist(playlist),
    {
      url: req.fullUrl,
      meta: { active: activeID === playlist.id },
    },
  );
}

/**
 * @type {import('../types').Controller}
 */
async function deletePlaylist(req) {
  const { user } = req;
  const { id } = req.params;
  const { playlists } = req.uwave;

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlists.deletePlaylist(playlist);

  return toItemResponse({}, { url: req.fullUrl });
}

const patchableKeys = ['name', 'description'];
/**
 * @type {import('../types').Controller}
 */
async function updatePlaylist(req) {
  const { user } = req;
  const { id } = req.params;
  const patch = req.body;
  const { playlists } = req.uwave;

  const patches = Object.keys(patch);
  patches.forEach((patchKey) => {
    if (!patchableKeys.includes(patchKey)) {
      throw new HTTPError(400, `Key "${patchKey}" cannot be updated.`);
    }
  });

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlists.updatePlaylist(playlist, patch);

  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

/**
 * @type {import('../types').Controller}
 */
async function renamePlaylist(req) {
  const { user } = req;
  const { id } = req.params;
  const { name } = req.body;
  const { playlists } = req.uwave;

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlists.updatePlaylist(playlist, { name });

  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

/**
 * @type {import('../types').Controller}
 */
async function activatePlaylist(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  user.activePlaylist = playlist._id;
  await user.save();

  return toItemResponse({});
}

/**
 * @type {import('../types').Controller}
 */
async function getPlaylistItems(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;
  const filter = req.query.filter || null;
  const pagination = getOffsetPagination(req.query);

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  const items = await playlists.getPlaylistItems(playlist, filter, pagination);

  return toPaginatedResponse(items, {
    baseUrl: req.fullUrl,
    included: {
      media: ['media'],
    },
  });
}

/**
 * @type {import('../types').Controller}
 */
async function addPlaylistItems(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;
  const { at, after, items } = req.body;

  if (!Array.isArray(items)) {
    throw new HTTPError(422, 'Expected "items" to be an array.');
  }

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  let afterID = after;
  if (at === 'start') {
    afterID = -1;
  } else if (at === 'end' && playlist.size > 0) {
    afterID = playlist.media[playlist.size - 1];
  }

  const {
    added,
    afterID: finalAfterID,
    playlistSize,
  } = await playlists.addPlaylistItems(playlist, items, { after: afterID });

  return toListResponse(added, {
    included: {
      media: ['media'],
    },
    meta: { afterID: finalAfterID, playlistSize },
  });
}

/**
 * @type {import('../types').Controller}
 */
async function removePlaylistItems(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;
  const items = req.query.items || req.body.items;

  if (!Array.isArray(items)) {
    throw new HTTPError(422, 'Expected "items" to be an array');
  }

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlists.removePlaylistItems(playlist, items);

  return toItemResponse({}, {
    meta: {
      playlistSize: playlist.size,
    },
  });
}

/**
 * @type {import('../types').Controller}
 */
async function movePlaylistItems(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;
  const { at, after, items } = req.body;

  if (!Array.isArray(items)) {
    throw new HTTPError(422, 'Expected "items" to be an array');
  }

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  let afterID = after;
  if (at === 'start') {
    afterID = -1;
  } else if (at === 'end') {
    afterID = playlist.media[playlist.size - 1];
  }

  const result = await playlists.movePlaylistItems(playlist, items, { afterID });

  return toItemResponse(result, { url: req.fullUrl });
}

/**
 * @type {import('../types').Controller}
 */
async function shufflePlaylistItems(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlists.shufflePlaylist(playlist);

  return toItemResponse({});
}

/**
 * @type {import('../types').Controller}
 */
async function getPlaylistItem(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id, itemID } = req.params;

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  const item = await playlists.getPlaylistItem(playlist, new ObjectId(itemID));
  if (!item) {
    throw new PlaylistItemNotFoundError({ playlist, id: itemID });
  }

  return toItemResponse(item, { url: req.fullUrl });
}

/**
 * @type {import('../types').Controller}
 */
async function updatePlaylistItem(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id, itemID } = req.params;
  const {
    artist, title, start, end,
  } = req.body;

  const patch = {
    artist,
    title,
    start,
    end,
  };

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  const item = await playlists.getPlaylistItem(playlist, new ObjectId(itemID));
  const updatedItem = await playlists.updatePlaylistItem(item, patch);

  return toItemResponse(updatedItem, { url: req.fullUrl });
}

/**
 * @type {import('../types').Controller}
 */
async function removePlaylistItem(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id, itemID } = req.params;

  const playlist = await playlists.getUserPlaylist(user, new ObjectId(id));
  if (!playlist) {
    throw new PlaylistNotFoundError('Playlist not found.');
  }

  const result = await playlists.removePlaylistItems(playlist, [itemID]);

  return toItemResponse(result, { url: req.fullUrl });
}

exports.getPlaylists = getPlaylists;
exports.getPlaylist = getPlaylist;
exports.createPlaylist = createPlaylist;
exports.deletePlaylist = deletePlaylist;
exports.updatePlaylist = updatePlaylist;
exports.renamePlaylist = renamePlaylist;
exports.activatePlaylist = activatePlaylist;
exports.getPlaylistItems = getPlaylistItems;
exports.addPlaylistItems = addPlaylistItems;
exports.removePlaylistItems = removePlaylistItems;
exports.movePlaylistItems = movePlaylistItems;
exports.shufflePlaylistItems = shufflePlaylistItems;
exports.getPlaylistItem = getPlaylistItem;
exports.updatePlaylistItem = updatePlaylistItem;
exports.removePlaylistItem = removePlaylistItem;
