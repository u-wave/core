import { groupBy, shuffle } from 'lodash';
import escapeStringRegExp from 'escape-string-regexp';
import createDebug from 'debug';
import NotFoundError from '../errors/NotFoundError';
import Page from '../Page';
import routes from '../routes/playlists';

const debug = createDebug('uwave:playlists');

function isValidPlaylistItem(item) {
  return typeof item === 'object'
    && typeof item.sourceType === 'string'
    && (typeof item.sourceID === 'string' || typeof item.sourceID === 'number');
}

/**
 * Calculate valid start/end times for a playlist item.
 */
function getStartEnd(item, media) {
  let { start, end } = item;
  if (!start || start < 0) {
    start = 0;
  } else if (start > media.duration) {
    start = media.duration;
  }
  if (!end || end > media.duration) {
    end = media.duration;
  } else if (end < start) {
    end = start;
  }
  return { start, end };
}

function toPlaylistItem(itemProps, media) {
  const { artist, title } = itemProps;
  const { start, end } = getStartEnd(itemProps, media);
  return {
    media,
    artist: artist || media.artist,
    title: title || media.title,
    start,
    end,
  };
}

export class PlaylistsRepository {
  constructor(uw) {
    this.uw = uw;
  }

  async getPlaylist(id) {
    const Playlist = this.uw.model('Playlist');
    if (id instanceof Playlist) {
      return id;
    }
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      throw new NotFoundError('Playlist not found.');
    }
    return playlist;
  }

  async getUserPlaylist(user, id) {
    const Playlist = this.uw.model('Playlist');
    const userID = typeof user === 'object' ? user.id : user;
    const playlist = await Playlist.findOne({ _id: id, author: userID });
    if (!playlist) {
      throw new NotFoundError('Playlist not found.');
    }
    return playlist;
  }

  async createPlaylist(userID, { name }) {
    const { users } = this.uw;
    const Playlist = this.uw.model('Playlist');
    const user = await users.getUser(userID);

    const playlist = await Playlist.create({
      name,
      author: user._id,
    });

    // If this is the user's first playlist, immediately activate it.
    try {
      // Throws if we don't have an active playlist yet.
      await user.getActivePlaylist();
    } catch (err) {
      debug(`activating first playlist for ${user.id} ${user.username}`);
      await user.setActivePlaylist(playlist);
    }

    return playlist;
  }

  async getUserPlaylists(user) {
    const Playlist = this.uw.model('Playlist');
    const userID = typeof user === 'object' ? user.id : user;
    const playlists = await Playlist.where('author').eq(userID);
    return playlists;
  }

  async updatePlaylist(playlistOrID, patch = {}) {
    const playlist = await this.getPlaylist(playlistOrID);
    Object.assign(playlist, patch);
    return playlist.save();
  }

  async shufflePlaylist(playlistOrID) {
    const playlist = await this.getPlaylist(playlistOrID);
    playlist.media = shuffle(playlist.media);
    return playlist.save();
  }

  async deletePlaylist(playlistOrID) {
    const playlist = await this.getPlaylist(playlistOrID);

    await playlist.remove();

    return {};
  }

  async getPlaylistItemIDsFiltered(playlist, filter) {
    const PlaylistItem = this.uw.model('PlaylistItem');
    const rx = new RegExp(escapeStringRegExp(filter), 'i');
    const matches = await PlaylistItem.where({
      _id: { $in: playlist.media },
      $or: [{ artist: rx }, { title: rx }],
    }).select('_id');

    const allItemIDs = matches.map((item) => item.id);

    // We want this sorted by the original playlist item order, so we can
    // just walk through the original playlist and only keep the items that we
    // need.
    return playlist.media.filter((id) => allItemIDs.indexOf(`${id}`) !== -1);
  }

  // eslint-disable-next-line class-methods-use-this
  async getPlaylistItemIDsUnfiltered(playlist) {
    return playlist.media;
  }

  async getPlaylistItem(itemID) {
    const PlaylistItem = this.uw.model('PlaylistItem');

    let item;
    if (itemID instanceof PlaylistItem) {
      item = itemID;
    } else {
      item = await PlaylistItem.findById(itemID);
    }

    if (!item) {
      throw new NotFoundError('Playlist item not found.');
    }

    if (!item.populated('media')) {
      await item.populate('media').execPopulate();
    }

    return item;
  }

  async getPlaylistItems(playlistOrID, filter = null, pagination = null) {
    const PlaylistItem = this.uw.model('PlaylistItem');
    const playlist = await this.getPlaylist(playlistOrID);
    const filteredItemIDs = filter
      ? await this.getPlaylistItemIDsFiltered(playlist, filter)
      : await this.getPlaylistItemIDsUnfiltered(playlist);

    let itemIDs = filteredItemIDs;
    if (pagination) {
      const start = pagination.offset;
      const end = start + pagination.limit;
      itemIDs = itemIDs.slice(start, end);
    }
    const items = itemIDs.length > 0
      ? await PlaylistItem.find()
        .where('_id').in(itemIDs)
        .populate('media')
      : [];

    const results = itemIDs.map((itemID) => items.find((item) => `${item.id}` === `${itemID}`));

    return new Page(results, {
      pageSize: pagination ? pagination.limit : null,
      filtered: filteredItemIDs.length,
      total: playlist.media.length,

      current: pagination,
      next: pagination ? {
        offset: pagination.offset + pagination.limit,
        limit: pagination.limit,
      } : null,
      previous: pagination ? {
        offset: Math.max(pagination.offset - pagination.limit, 0),
        limit: pagination.limit,
      } : null,
    });
  }

  /**
   * Bulk create playlist items from arbitrary sources.
   */
  async createPlaylistItems(userID, items) {
    const Media = this.uw.model('Media');
    const PlaylistItem = this.uw.model('PlaylistItem');
    const User = this.uw.model('User');

    if (!items.every(isValidPlaylistItem)) {
      throw new Error('Cannot add a playlist item without a proper media source type and ID.');
    }

    const user = await User.findById(userID);

    // Group by source so we can retrieve all unknown medias from the source in
    // one call.
    const itemsBySourceType = groupBy(items, 'sourceType');
    const playlistItems = [];
    const promises = Object.keys(itemsBySourceType).map(async (sourceType) => {
      const sourceItems = itemsBySourceType[sourceType];
      const knownMedias = await Media.find({
        sourceType,
        sourceID: { $in: sourceItems.map((item) => item.sourceID) },
      });

      const unknownMediaIDs = [];
      sourceItems.forEach((item) => {
        if (!knownMedias.some((media) => media.sourceID === String(item.sourceID))) {
          unknownMediaIDs.push(item.sourceID);
        }
      });

      let allMedias = knownMedias;
      if (unknownMediaIDs.length > 0) {
        const unknownMedias = await this.uw.source(sourceType)
          .get(user, unknownMediaIDs);
        allMedias = allMedias.concat(await Media.create(unknownMedias));
      }

      const itemsWithMedia = sourceItems.map((item) => toPlaylistItem(
        item,
        allMedias.find((media) => media.sourceID === String(item.sourceID)),
      ));
      playlistItems.push(...itemsWithMedia);
    });

    await Promise.all(promises);

    return PlaylistItem.create(playlistItems);
  }

  /**
   * Add items to a playlist.
   */
  async addPlaylistItems(playlistOrID, items, { after = null } = {}) {
    const playlist = await this.getPlaylist(playlistOrID);
    const userID = playlist.author.toString();
    const newItems = await this.createPlaylistItems(userID, items);
    const oldMedia = playlist.media;
    const insertIndex = oldMedia.findIndex((item) => `${item}` === after);
    playlist.media = [
      ...oldMedia.slice(0, insertIndex + 1),
      ...newItems,
      ...oldMedia.slice(insertIndex + 1),
    ];

    await playlist.save();

    return {
      added: newItems,
      afterID: after,
      playlistSize: playlist.media.length,
    };
  }

  async updatePlaylistItem(itemOrID, patch = {}) {
    const item = await this.getPlaylistItem(itemOrID);

    Object.assign(item, patch);

    return item.save();
  }

  async movePlaylistItems(playlistOrID, itemIDs, { afterID }) {
    const playlist = await this.getPlaylist(playlistOrID);

    // Create a plain array instead of a mongoose array because it crashes on splice()
    // otherwise.
    const newMedia = [...playlist.media].filter((item) => !itemIDs.includes(`${item}`));
    // Reinsert items at their new position.
    const insertIndex = newMedia.findIndex((item) => `${item}` === afterID);
    newMedia.splice(insertIndex + 1, 0, ...itemIDs);
    playlist.media = newMedia;

    await playlist.save();

    return {};
  }

  async removePlaylistItems(playlistOrID, itemsOrIDs) {
    const PlaylistItem = this.uw.model('PlaylistItem');
    const playlist = await this.getPlaylist(playlistOrID);

    // Only remove items that are actually in this playlist.
    const stringIDs = itemsOrIDs.map((item) => String(item));
    const toRemove = [];
    const toKeep = [];
    playlist.media.forEach((itemID) => {
      if (stringIDs.indexOf(`${itemID}`) !== -1) {
        toRemove.push(itemID);
      } else {
        toKeep.push(itemID);
      }
    });

    playlist.media = toKeep;
    await playlist.save();
    await PlaylistItem.remove({ _id: { $in: toRemove } });

    return {};
  }
}

export default function playlistsPlugin() {
  return (uw) => {
    uw.playlists = new PlaylistsRepository(uw);
    uw.httpApi.use('/playlists', routes());
  };
}
