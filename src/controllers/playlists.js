'use strict';

const { ObjectID } = require('mongoose').mongo;
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

/**
 * @typedef {object} GetPlaylistsQuery
 * @prop {string} contains
 */

/**
 * @type {import('../types').AuthenticatedController<{}, GetPlaylistsQuery>}
 */
async function getPlaylists(req) {
  const { user } = req;
  const uw = req.uwave;
  const { contains } = req.query;

  let playlists;
  if (contains) {
    const containsID = new ObjectID(contains);

    playlists = await uw.playlists.getPlaylistsContainingMedia(containsID, { author: user._id });
  } else {
    playlists = await uw.playlists.getUserPlaylists(user);
  }

  return toListResponse(
    playlists.map(serializePlaylist),
    { url: req.fullUrl },
  );
}

/**
 * @typedef {object} GetPlaylistParams
 * @prop {string} id
 */

/**
 * @type {import('../types').AuthenticatedController<GetPlaylistParams>}
 */
async function getPlaylist(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));

  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

/**
 * @typedef {object} CreatePlaylistBody
 * @prop {string} name
 */

/**
 * @type {import('../types').AuthenticatedController<{}, {}, CreatePlaylistBody>}
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
 * @typedef {object} DeletePlaylistParams
 * @prop {string} id
 */

/**
 * @type {import('../types').AuthenticatedController<DeletePlaylistParams>}
 */
async function deletePlaylist(req) {
  const { user } = req;
  const { id } = req.params;
  const { playlists } = req.uwave;

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlists.deletePlaylist(playlist);

  return toItemResponse({}, { url: req.fullUrl });
}

const patchableKeys = ['name', 'description'];

/**
 * @typedef {object} UpdatePlaylistParams
 * @prop {string} id
 *
 * @typedef {Record<string, string>} UpdatePlaylistBody
 */

/**
 * @type {import('../types').AuthenticatedController<UpdatePlaylistParams, {}, UpdatePlaylistBody>}
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

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));
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
 * @typedef {object} RenamePlaylistParams
 * @prop {string} id
 *
 * @typedef {object} RenamePlaylistBody
 * @prop {string} name
 */

/**
 * @type {import('../types').AuthenticatedController<RenamePlaylistParams, {}, RenamePlaylistBody>}
 */
async function renamePlaylist(req) {
  const { user } = req;
  const { id } = req.params;
  const { name } = req.body;
  const { playlists } = req.uwave;

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));
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
 * @typedef {object} ActivatePlaylistParams
 * @prop {string} id
 */

/**
 * @type {import('../types').AuthenticatedController<ActivatePlaylistParams>}
 */
async function activatePlaylist(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  user.activePlaylist = playlist._id;
  await user.save();

  return toItemResponse({});
}

/**
 * @typedef {object} GetPlaylistItemsParams
 * @prop {string} id
 */

/**
 * @type {import('../types').AuthenticatedController<GetPlaylistItemsParams>}
 */
async function getPlaylistItems(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;
  const filter = req.query.filter || null;
  const pagination = getOffsetPagination(req.query);

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));
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
 * @typedef {import('../plugins/playlists').PlaylistItemDesc} PlaylistItemDesc
 *
 * @typedef {object} AddPlaylistItemsParams
 * @prop {string} id
 *
 * @typedef {object} AtPosition
 * @prop {'start'|'end'} at
 * @prop {undefined} after
 *
 * @typedef {object} AfterPosition
 * @prop {undefined} at
 * @prop {string|-1} after
 *
 * @typedef {{ items: PlaylistItemDesc[] } & (AtPosition | AfterPosition)} AddPlaylistItemsBody
 */

/**
 * @type {import('../types').AuthenticatedController<AddPlaylistItemsParams, {}, AddPlaylistItemsBody>}
 */
async function addPlaylistItems(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;
  const { at, after, items } = req.body;

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  /** @type {ObjectID|null} */
  let afterID = null;
  if (at === 'start') {
    afterID = null;
  } else if (at === 'end' || after === -1) {
    afterID = playlist.media[playlist.size - 1];
  } else {
    afterID = new ObjectID(after);
  }

  const {
    added,
    afterID: actualAfterID,
    playlistSize,
  } = await playlists.addPlaylistItems(playlist, items, { after: afterID });

  return toListResponse(added, {
    included: {
      media: ['media'],
    },
    meta: { afterID: actualAfterID.toString(), playlistSize },
  });
}

/**
 * @typedef {object} RemovePlaylistItemsParams
 * @prop {string} id
 *
 * @typedef {object} RemovePlaylistItemsBody
 * @prop {string[]} items
 */

/**
 * @type {import('../types').AuthenticatedController<RemovePlaylistItemsParams, {}, RemovePlaylistItemsBody>}
 */
async function removePlaylistItems(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;
  const { items } = req.body;

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlists.removePlaylistItems(playlist, items.map((item) => new ObjectID(item)));

  return toItemResponse({}, {
    meta: {
      playlistSize: playlist.size,
    },
  });
}

/**
 * @typedef {object} MovePlaylistItemsParams
 * @prop {string} id
 *
 * @typedef {{ items: string[] } & (AtPosition | AfterPosition)} MovePlaylistItemsBody
 */

/**
 * @type {import('../types').AuthenticatedController<MovePlaylistItemsParams, {}, MovePlaylistItemsBody>}
 */
async function movePlaylistItems(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;
  const { at, after, items } = req.body;

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  let afterID = null;
  if (at === 'start') {
    afterID = null;
  } else if (at === 'end' || after === -1) {
    afterID = playlist.media[playlist.size - 1];
  } else {
    afterID = new ObjectID(after);
  }

  const itemIDs = items.map((item) => new ObjectID(item));
  const result = await playlists.movePlaylistItems(playlist, itemIDs, { afterID });

  return toItemResponse(result, { url: req.fullUrl });
}

/**
 * @typedef {object} ShufflePlaylistItemsParams
 * @prop {string} id
 */

/**
 * @type {import('../types').AuthenticatedController<ShufflePlaylistItemsParams>}
 */
async function shufflePlaylistItems(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id } = req.params;

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlists.shufflePlaylist(playlist);

  return toItemResponse({});
}

/**
 * @typedef {object} GetPlaylistItemParams
 * @prop {string} id
 * @prop {string} itemID
 */

/**
 * @type {import('../types').AuthenticatedController<GetPlaylistItemParams>}
 */
async function getPlaylistItem(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id, itemID } = req.params;

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  const item = await playlists.getPlaylistItem(playlist, new ObjectID(itemID));
  if (!item) {
    throw new PlaylistItemNotFoundError({ playlist, id: itemID });
  }

  return toItemResponse(item, { url: req.fullUrl });
}

/**
 * @typedef {object} UpdatePlaylistItemParams
 * @prop {string} id
 * @prop {string} itemID
 *
 * @typedef {object} UpdatePlaylistItemBody
 * @prop {string} [artist]
 * @prop {string} [title]
 * @prop {number} [start]
 * @prop {number} [end]
 */

/**
 * @type {import('../types').AuthenticatedController<UpdatePlaylistItemParams, {}, UpdatePlaylistItemBody>}
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

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  const item = await playlists.getPlaylistItem(playlist, new ObjectID(itemID));
  const updatedItem = await playlists.updatePlaylistItem(item, patch);

  return toItemResponse(updatedItem, { url: req.fullUrl });
}

/**
 * @typedef {object} RemovePlaylistItemParams
 * @prop {string} id
 * @prop {string} itemID
 */

/**
 * @type {import('../types').AuthenticatedController<RemovePlaylistItemParams>}
 */
async function removePlaylistItem(req) {
  const { user } = req;
  const { playlists } = req.uwave;
  const { id, itemID } = req.params;

  const playlist = await playlists.getUserPlaylist(user, new ObjectID(id));
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  const result = await playlists.removePlaylistItems(playlist, [new ObjectID(itemID)]);

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
