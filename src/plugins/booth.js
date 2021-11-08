'use strict';

const ms = require('ms');
const RedLock = require('redlock');
const createDebug = require('debug');
const { omit } = require('lodash');
const { EmptyPlaylistError, PlaylistItemNotFoundError } = require('../errors');
const routes = require('../routes/booth');

/**
 * @typedef {import('../models').User} User
 * @typedef {import('../models').Playlist} Playlist
 * @typedef {import('../models').PlaylistItem} PlaylistItem
 * @typedef {import('../models').HistoryEntry} HistoryEntry
 * @typedef {import('../models/History').HistoryMedia} HistoryMedia
 * @typedef {import('../models').Media} Media
 * @typedef {{ user: User }} PopulateUser
 * @typedef {{ playlist: Playlist }} PopulatePlaylist
 * @typedef {{ media: Omit<HistoryMedia, 'media'> & { media: Media } }} PopulateMedia
 * @typedef {Omit<HistoryEntry, 'user' | 'playlist' | 'media'>
 *     & PopulateUser & PopulatePlaylist & PopulateMedia} PopulatedHistoryEntry
 */

const debug = createDebug('uwave:advance');

/**
 * @param {Playlist} playlist
 * @returns {Promise<void>}
 */
async function cyclePlaylist(playlist) {
  const item = playlist.media.shift();
  if (item !== undefined) {
    playlist.media.push(item);
  }
  await playlist.save();
}

class Booth {
  #uw;

  /** @type {ReturnType<typeof setTimeout>|null} */
  #timeout = null;

  #locker;

  /**
   * @param {import('../Uwave')} uw
   */
  constructor(uw) {
    this.#uw = uw;
    this.#locker = new RedLock([this.#uw.redis]);
  }

  /** @internal */
  async onStart() {
    const current = await this.getCurrentEntry();
    if (current && this.#timeout === null) {
      // Restart the advance timer after a server restart, if a track was
      // playing before the server restarted.
      const duration = (current.media.end - current.media.start) * ms('1 second');
      const endTime = Number(current.playedAt) + duration;
      if (endTime > Date.now()) {
        this.#timeout = setTimeout(
          () => this.advance(),
          endTime - Date.now(),
        );
      } else {
        this.advance();
      }
    }
  }

  /** @internal */
  onStop() {
    this.maybeStop();
  }

  /**
   * @returns {Promise<HistoryEntry | null>}
   */
  async getCurrentEntry() {
    const { HistoryEntry } = this.#uw.models;
    const historyID = await this.#uw.redis.get('booth:historyID');
    if (!historyID) {
      return null;
    }

    return HistoryEntry.findById(historyID, '+media.sourceData');
  }

  /**
   * Get vote counts for the currently playing media.
   *
   * @returns {Promise<{ upvotes: number, downvotes: number, favorites: number }>}
   */
  async getCurrentVoteStats() {
    const { redis } = this.#uw;

    const results = await redis.pipeline()
      .smembers('booth:upvotes')
      .smembers('booth:downvotes')
      .smembers('booth:favorites')
      .exec();

    // TODO what if there is an error?
    const voteStats = {
      upvotes: results[0][1],
      downvotes: results[1][1],
      favorites: results[2][1],
    };

    return voteStats;
  }

  /**
   * @param {HistoryEntry} entry
   * @private
   */
  async saveStats(entry) {
    const stats = await this.getCurrentVoteStats();

    Object.assign(entry, stats);
    return entry.save();
  }

  /**
   * @param {{ remove?: boolean }} options
   * @returns {Promise<User|null>}
   * @private
   */
  async getNextDJ(options) {
    const { User } = this.#uw.models;
    /** @type {string|null} */
    let userID = await this.#uw.redis.lindex('waitlist', 0);
    if (!userID && !options.remove) {
      // If the waitlist is empty, the current DJ will play again immediately.
      userID = await this.#uw.redis.get('booth:currentDJ');
    }
    if (!userID) {
      return null;
    }

    return User.findById(userID);
  }

  /**
   * @param {{ remove?: boolean }} options
   * @returns {Promise<PopulatedHistoryEntry | null>}
   * @private
   */
  async getNextEntry(options) {
    const { HistoryEntry, PlaylistItem } = this.#uw.models;
    const { playlists } = this.#uw;

    const user = await this.getNextDJ(options);
    if (!user || !user.activePlaylist) {
      return null;
    }
    const playlist = await playlists.getUserPlaylist(user, user.activePlaylist);
    if (playlist.size === 0) {
      throw new EmptyPlaylistError();
    }

    const playlistItem = await PlaylistItem.findById(playlist.media[0]);
    if (!playlistItem) {
      throw new PlaylistItemNotFoundError({ id: playlist.media[0] });
    }

    /** @type {PopulatedHistoryEntry} */
    // @ts-ignore TS2322: `user` and `playlist` are already populated,
    // and `media.media` is populated immediately below.
    const entry = new HistoryEntry({
      user,
      playlist,
      item: playlistItem._id,
      media: {
        media: playlistItem.media,
        artist: playlistItem.artist,
        title: playlistItem.title,
        start: playlistItem.start,
        end: playlistItem.end,
      },
    });
    await entry.populate('media.media');

    return entry;
  }

  /**
   * @param {HistoryEntry|null} previous
   * @param {{ remove?: boolean }} options
   * @private
   */
  async cycleWaitlist(previous, options) {
    const waitlistLen = await this.#uw.redis.llen('waitlist');
    if (waitlistLen > 0) {
      await this.#uw.redis.lpop('waitlist');
      if (previous && !options.remove) {
        // The previous DJ should only be added to the waitlist again if it was
        // not empty. If it was empty, the previous DJ is already in the booth.
        await this.#uw.redis.rpush('waitlist', previous.user.toString());
      }
    }
  }

  clear() {
    return this.#uw.redis.del(
      'booth:historyID',
      'booth:currentDJ',
      'booth:upvotes',
      'booth:downvotes',
      'booth:favorites',
    );
  }

  /**
   * @param {PopulatedHistoryEntry} next
   * @private
   */
  update(next) {
    return this.#uw.redis.multi()
      .del('booth:upvotes', 'booth:downvotes', 'booth:favorites')
      .set('booth:historyID', next.id)
      .set('booth:currentDJ', next.user.id)
      .exec();
  }

  /**
   * @private
   */
  maybeStop() {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }
  }

  /**
   * @param {PopulatedHistoryEntry} entry
   * @private
   */
  play(entry) {
    this.maybeStop();
    this.#timeout = setTimeout(
      () => this.advance(),
      (entry.media.end - entry.media.start) * ms('1 second'),
    );
  }

  /**
   * @private
   */
  getWaitlist() {
    return this.#uw.redis.lrange('waitlist', 0, -1);
  }

  /**
   * This method creates a `media` object that clients can understand from a
   * history entry object.
   *
   * We present the playback-specific `sourceData` as if it is
   * a property of the media model for backwards compatibility.
   * Old clients don't expect `sourceData` directly on a history entry object.
   *
   * @param {PopulateMedia} historyEntry
   */
  // eslint-disable-next-line class-methods-use-this
  getMediaForPlayback(historyEntry) {
    return Object.assign(omit(historyEntry.media, 'sourceData'), {
      media: {
        ...historyEntry.media.media.toJSON(),
        sourceData: {
          ...historyEntry.media.media.sourceData,
          ...historyEntry.media.sourceData,
        },
      },
    });
  }

  /**
   * @param {PopulatedHistoryEntry|null} next
   * @private
   */
  async publish(next) {
    if (next) {
      this.#uw.publish('advance:complete', {
        historyID: next.id,
        userID: next.user.id,
        playlistID: next.playlist.id,
        itemID: next.item.toString(),
        media: this.getMediaForPlayback(next),
        playedAt: next.playedAt.getTime(),
      });
      this.#uw.publish('playlist:cycle', {
        userID: next.user.id,
        playlistID: next.playlist.id,
      });
    } else {
      this.#uw.publish('advance:complete', null);
    }
    this.#uw.publish('waitlist:update', await this.getWaitlist());
  }

  /**
   * @param {PopulatedHistoryEntry} entry
   * @private
   */
  async getSourceDataForPlayback(entry) {
    const { sourceID, sourceType } = entry.media.media;
    const source = this.#uw.source(sourceType);
    if (source) {
      debug('Running %s pre-play hook for %s', source.type, sourceID);
      const sourceData = await source.play(entry.user, entry.media.media);
      debug('sourceData', sourceData);
      return sourceData;
    }

    return undefined;
  }

  /**
   * @typedef {object} AdvanceOptions
   * @prop {boolean} [remove]
   * @prop {boolean} [publish]
   *
   * @param {AdvanceOptions} [opts]
   * @param {import('redlock').Lock} [reuseLock]
   * @returns {Promise<PopulatedHistoryEntry|null>}
   */
  async advance(opts = {}, reuseLock = undefined) {
    let lock;
    try {
      if (reuseLock) {
        lock = await reuseLock.extend(ms('10 seconds'));
      } else {
        lock = await this.#locker.lock('booth:advancing', ms('10 seconds'));
      }
    } catch (err) {
      throw new Error('Another advance is still in progress.');
    }

    const previous = await this.getCurrentEntry();
    let next;
    try {
      next = await this.getNextEntry(opts);
    } catch (err) {
      // If the next user's playlist was empty, remove them from the waitlist
      // and try advancing again.
      if (err.code === 'PLAYLIST_IS_EMPTY') {
        debug('user has empty playlist, skipping on to the next');
        await this.cycleWaitlist(previous, opts);
        return this.advance({ ...opts, remove: true }, lock);
      }
      throw err;
    }

    if (previous) {
      await this.saveStats(previous);

      debug(
        'previous track:', previous.media.artist, '—', previous.media.title,
        `👍 ${previous.upvotes.length} `
        + `★ ${previous.favorites.length} `
        + `👎 ${previous.downvotes.length}`,
      );
    }

    if (next) {
      const sourceData = await this.getSourceDataForPlayback(next);
      if (sourceData) {
        next.media.sourceData = sourceData;
      }
      await next.save();
    } else {
      this.maybeStop();
    }

    await this.cycleWaitlist(previous, opts);

    if (next) {
      await this.update(next);
      await cyclePlaylist(next.playlist);
      this.play(next);
    } else {
      await this.clear();
    }

    if (opts.publish !== false) {
      await this.publish(next);
    }

    lock.unlock().catch(() => {
      // Don't really care if this fails, it'll expire in some seconds anyway.
    });

    return next;
  }
}

/**
 * @param {import('../Uwave').Boot} uw
 */
async function boothPlugin(uw) {
  uw.booth = new Booth(uw);
  uw.httpApi.use('/booth', routes());

  uw.after(async (err) => {
    if (!err) {
      await uw.booth.onStart();
    }
  });
  uw.onClose(() => {
    uw.booth.onStop();
  });
}

module.exports = boothPlugin;
module.exports.Booth = Booth;
