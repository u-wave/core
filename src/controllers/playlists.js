import {
  HTTPError,
  PlaylistNotFoundError,
  PlaylistItemNotFoundError,
} from '../errors';
import { serializePlaylist } from '../utils/serialize';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';
import toPaginatedResponse from '../utils/toPaginatedResponse';

export async function getPlaylists(req) {
  const { user } = req;
  const uw = req.uwave;
  const { contains } = req.query;

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

export async function getPlaylist(req) {
  const { user } = req;
  const { id } = req.params;

  const playlist = await user.getPlaylist(id);

  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

export async function createPlaylist(req) {
  const { user } = req;
  const { name, description, shared } = req.body;

  const playlist = await user.createPlaylist({
    name,
    description,
    shared,
  });

  const activeID = await user.getActivePlaylistID();

  return toItemResponse(
    serializePlaylist(playlist),
    {
      url: req.fullUrl,
      meta: { active: activeID === playlist.id },
    },
  );
}

export async function deletePlaylist(req) {
  const { user } = req;
  const { id } = req.params;
  const { playlists } = req.uwave;

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  const result = await playlists.deletePlaylist(playlist);

  return toItemResponse(result, { url: req.fullUrl });
}

const patchableKeys = ['name', 'shared', 'description'];
export async function updatePlaylist(req) {
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

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlists.updatePlaylist(playlist, patch);

  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

export async function renamePlaylist(req) {
  const { user } = req;
  const { id } = req.params;
  const { name } = req.body;
  const { playlists } = req.uwave;

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlists.updatePlaylist(playlist, { name });

  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

export async function sharePlaylist(req) {
  const { user } = req;
  const { id } = req.params;
  const { shared } = req.body;
  const { playlists } = req.uwave;

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlists.updatePlaylist(playlist, { shared });

  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

export async function activatePlaylist(req) {
  const { user } = req;
  const { id } = req.params;

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await user.setActivePlaylist(playlist.id);

  return toItemResponse({});
}

export async function getPlaylistItems(req) {
  const { user } = req;
  const { id } = req.params;
  const filter = req.query.filter || null;
  const pagination = getOffsetPagination(req.query);

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  const items = await playlist.getItems(filter, pagination);

  return toPaginatedResponse(items, {
    baseUrl: req.fullUrl,
    included: {
      media: ['media'],
    },
  });
}

export async function addPlaylistItems(req) {
  const { user } = req;
  const { id } = req.params;
  const { at, after, items } = req.body;

  if (!Array.isArray(items)) {
    throw new HTTPError(422, 'Expected "items" to be an array.');
  }

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  let afterID = after;
  if (at === 'start') {
    afterID = -1;
  } else if (at === 'end') {
    const last = await playlist.getItemAt(playlist.size - 1);
    afterID = last.id;
  }

  const {
    added,
    afterID: finalAfterID,
    playlistSize,
  } = await playlist.addItems(items, { after: afterID });

  return toListResponse(added, {
    included: {
      media: ['media'],
    },
    meta: { afterID: finalAfterID, playlistSize },
  });
}

export async function removePlaylistItems(req) {
  const { user } = req;
  const { id } = req.params;
  const items = req.query.items || req.body.items;

  if (!Array.isArray(items)) {
    throw new HTTPError(422, 'Expected "items" to be an array');
  }

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlist.removeItems(items);

  return toItemResponse({}, {
    meta: {
      playlistSize: playlist.size,
    },
  });
}

export async function movePlaylistItems(req) {
  const { user } = req;
  const { id } = req.params;
  const { at, after, items } = req.body;

  if (!Array.isArray(items)) {
    throw new HTTPError(422, 'Expected "items" to be an array');
  }

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  let afterID = after;
  if (at === 'start') {
    afterID = -1;
  } else if (at === 'end') {
    const last = await playlist.getItemAt(playlist.size - 1);
    afterID = last.id;
  }

  const result = await playlist.moveItems(items, { afterID });

  return toItemResponse(result, { url: req.fullUrl });
}

export async function shufflePlaylistItems(req) {
  const { user } = req;
  const { id } = req.params;

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  await playlist.shuffle();

  return toItemResponse({});
}

export async function getPlaylistItem(req) {
  const { user } = req;
  const { id, itemID } = req.params;

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  const item = await playlist.getItem(itemID);
  if (!item) {
    throw new PlaylistItemNotFoundError({ playlist, id: itemID });
  }

  return toItemResponse(item, { url: req.fullUrl });
}

export async function updatePlaylistItem(req) {
  const { user } = req;
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

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError({ id });
  }

  const item = await playlist.updateItem(itemID, patch);

  return toItemResponse(item, { url: req.fullUrl });
}

export async function removePlaylistItem(req) {
  const { user } = req;
  const { id, itemID } = req.params;

  const playlist = await user.getPlaylist(id);
  if (!playlist) {
    throw new PlaylistNotFoundError('Playlist not found.');
  }

  const result = await playlist.removeItem(itemID);

  return toItemResponse(result, { url: req.fullUrl });
}
