import Mutex from 'p-mutex';
import { sql } from 'kysely';
import { EmptyPlaylistError, PlaylistItemNotFoundError } from '../errors/index.js';
import routes from '../routes/booth.js';
import { randomUUID } from 'node:crypto';
import { fromJson, jsonb, jsonGroupArray } from '../utils/sqlite.js';

/**
 * @typedef {import('../schema.js').UserID} UserID
 * @typedef {import('../schema.js').HistoryEntryID} HistoryEntryID
 * @typedef {import('type-fest').JsonObject} JsonObject
 * @typedef {import('../schema.js').User} User
 * @typedef {import('../schema.js').Playlist} Playlist
 * @typedef {import('../schema.js').PlaylistItem} PlaylistItem
 * @typedef {import('../schema.js').HistoryEntry} HistoryEntry
 * @typedef {Omit<import('../schema.js').Media, 'createdAt' | 'updatedAt'>} Media
 */

const KEY_HISTORY_ID = 'booth:historyID';
const KEY_CURRENT_DJ_ID = 'booth:currentDJ';
const KEY_REMOVE_AFTER_CURRENT_PLAY = 'booth:removeAfterCurrentPlay';

class Booth {
  #uw;

  #logger;

  /** @type {ReturnType<typeof setTimeout>|null} */
  #timeout = null;

  #mutex;

  /** @type {Promise<unknown>|null} */
  #awaitAdvance = null;

  /**
   * @param {import('../Uwave.js').Boot} uw
   */
  constructor(uw) {
    this.#uw = uw;
    this.#mutex = new Mutex();
    this.#logger = uw.logger.child({ ns: 'uwave:booth' });
  }

  /** @internal */
  async onStart() {
    const current = await this.getCurrentEntry();
    if (current && this.#timeout === null) {
      // Restart the advance timer after a server restart, if a track was
      // playing before the server restarted.
      const duration = (current.historyEntry.end - current.historyEntry.start) * 1000;
      const endTime = current.historyEntry.createdAt.getTime() + duration;
      if (endTime > Date.now()) {
        this.#timeout = setTimeout(
          () => this.#advanceAutomatically(),
          endTime - Date.now(),
        );
      } else {
        this.#advanceAutomatically();
      }
    }

    this.#uw.onClose(async () => {
      this.#onStop();
      await this.#awaitAdvance;
    });
  }

  async #advanceAutomatically() {
    try {
      await this.advance();
    } catch (error) {
      this.#logger.error({ err: error }, 'advance failed');
    }
  }

  #onStop() {
    this.#maybeStop();
  }

  async getCurrentEntry(tx = this.#uw.db) {
    const entry = await tx.selectFrom('keyval')
      .where('key', '=', KEY_HISTORY_ID)
      .innerJoin('historyEntries', (join) => join.on(
        (eb) => sql`${eb.ref('value')}->>'$'`,
        '=',
        (eb) => eb.ref('historyEntries.id'),
      ))
      .innerJoin('media', 'historyEntries.mediaID', 'media.id')
      .innerJoin('users', 'historyEntries.userID', 'users.id')
      .select([
        'historyEntries.id as id',
        'media.id as media.id',
        'media.sourceID as media.sourceID',
        'media.sourceType as media.sourceType',
        'media.sourceData as media.sourceData',
        'media.artist as media.artist',
        'media.title as media.title',
        'media.duration as media.duration',
        'media.thumbnail as media.thumbnail',
        'users.id as users.id',
        'users.username as users.username',
        'users.avatar as users.avatar',
        'users.createdAt as users.createdAt',
        'historyEntries.artist',
        'historyEntries.title',
        'historyEntries.start',
        'historyEntries.end',
        'historyEntries.createdAt',
        (eb) => eb.selectFrom('feedback')
          .where('historyEntryID', '=', eb.ref('historyEntries.id'))
          .where('vote', '=', 1)
          .select((eb) => jsonGroupArray(eb.ref('userID')).as('userIDs'))
          .as('upvotes'),
        (eb) => eb.selectFrom('feedback')
          .where('historyEntryID', '=', eb.ref('historyEntries.id'))
          .where('vote', '=', -1)
          .select((eb) => jsonGroupArray(eb.ref('userID')).as('userIDs'))
          .as('downvotes'),
        (eb) => eb.selectFrom('feedback')
          .where('historyEntryID', '=', eb.ref('historyEntries.id'))
          .where('favorite', '=', 1)
          .select((eb) => jsonGroupArray(eb.ref('userID')).as('userIDs'))
          .as('favorites'),
      ])
      .executeTakeFirst();

    return entry ? {
      media: {
        id: entry['media.id'],
        artist: entry['media.artist'],
        title: entry['media.title'],
        duration: entry['media.duration'],
        thumbnail: entry['media.thumbnail'],
        sourceID: entry['media.sourceID'],
        sourceType: entry['media.sourceType'],
        sourceData: entry['media.sourceData'] ?? {},
      },
      user: {
        id: entry['users.id'],
        username: entry['users.username'],
        avatar: entry['users.avatar'],
        createdAt: entry['users.createdAt'],
      },
      historyEntry: {
        id: entry.id,
        userID: entry['users.id'],
        mediaID: entry['media.id'],
        artist: entry.artist,
        title: entry.title,
        start: entry.start,
        end: entry.end,
        createdAt: entry.createdAt,
      },
      upvotes: entry.upvotes != null ? fromJson(entry.upvotes) : [],
      downvotes: entry.downvotes != null ? fromJson(entry.downvotes) : [],
      favorites: entry.favorites != null ? fromJson(entry.favorites) : [],
    } : null;
  }

  /**
   * @param {{ remove?: boolean }} options
   */
  async #getNextDJ(options, tx = this.#uw.db) {
    const waitlist = await this.#uw.waitlist.getUserIDs();
    let userID = waitlist.at(0) ?? null;
    if (!userID && !options.remove) {
      // If the waitlist is empty, the current DJ will play again immediately.
      userID = /** @type {UserID|null} */ (await this.#uw.keyv.get(KEY_CURRENT_DJ_ID, tx));
    }
    if (!userID) {
      return null;
    }

    return this.#uw.users.getUser(userID, tx);
  }

  /**
   * @param {{ remove?: boolean }} options
   */
  async #getNextEntry(options) {
    const { playlists } = this.#uw;

    const user = await this.#getNextDJ(options);
    if (!user || !user.activePlaylistID) {
      return null;
    }
    const playlist = await playlists.getUserPlaylist(user, user.activePlaylistID);
    if (playlist.size === 0) {
      throw new EmptyPlaylistError();
    }

    const { playlistItem, media } = await playlists.getPlaylistItemAt(playlist, 0);
    if (!playlistItem) {
      throw new PlaylistItemNotFoundError();
    }

    return {
      user,
      playlist,
      playlistItem,
      media,
      historyEntry: {
        id: /** @type {HistoryEntryID} */ (randomUUID()),
        userID: user.id,
        mediaID: media.id,
        artist: playlistItem.artist,
        title: playlistItem.title,
        start: playlistItem.start,
        end: playlistItem.end,
        /** @type {null | JsonObject} */
        sourceData: null,
        createdAt: new Date(),
      },
    };
  }

  /**
   * @param {UserID|null} previous
   * @param {{ remove?: boolean }} options
   */
  async #cycleWaitlist(previous, options) {
    await this.#uw.waitlist.cycle(previous, options);
  }

  async clear(tx = this.#uw.db) {
    await this.#uw.keyv.delete(KEY_REMOVE_AFTER_CURRENT_PLAY, tx);
    await this.#uw.keyv.delete(KEY_HISTORY_ID, tx);
    await this.#uw.keyv.delete(KEY_CURRENT_DJ_ID, tx);
  }

  /**
   * @param {{ historyEntry: { id: HistoryEntryID }, user: { id: UserID } }} next
   */
  async #update(next, tx = this.#uw.db) {
    await this.#uw.keyv.delete(KEY_REMOVE_AFTER_CURRENT_PLAY, tx);
    await this.#uw.keyv.set(KEY_HISTORY_ID, next.historyEntry.id, tx);
    await this.#uw.keyv.set(KEY_CURRENT_DJ_ID, next.user.id, tx);
  }

  #maybeStop() {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }
  }

  /**
   * @param {Pick<HistoryEntry, 'start' | 'end'>} entry
   */
  #play(entry) {
    this.#maybeStop();
    this.#timeout = setTimeout(
      () => this.#advanceAutomatically(),
      (entry.end - entry.start) * 1000,
    );
  }

  /**
   * This method creates a `media` object that clients can understand from a
   * history entry object.
   *
   * We present the playback-specific `sourceData` as if it is
   * a property of the media model for backwards compatibility.
   * Old clients don't expect `sourceData` directly on a history entry object.
   *
   * @param {{ user: User, media: Media, historyEntry: HistoryEntry }} next
   */
  getMediaForPlayback(next) {
    return {
      artist: next.historyEntry.artist,
      title: next.historyEntry.title,
      start: next.historyEntry.start,
      end: next.historyEntry.end,
      media: {
        sourceType: next.media.sourceType,
        sourceID: next.media.sourceID,
        artist: next.media.artist,
        title: next.media.title,
        duration: next.media.duration,
        sourceData: {
          ...next.media.sourceData,
          ...next.historyEntry.sourceData,
        },
      },
    };
  }

  /**
   * @param {{
   *   user: User,
   *   playlist: Playlist,
   *   media: Media,
   *   historyEntry: HistoryEntry
   * } | null} next
   */
  async #publishAdvanceComplete(next) {
    const { waitlist } = this.#uw;

    if (next != null) {
      this.#uw.publish('advance:complete', {
        historyID: next.historyEntry.id,
        userID: next.user.id,
        playlistID: next.playlist.id,
        media: this.getMediaForPlayback(next),
        playedAt: next.historyEntry.createdAt.getTime(),
      });
      this.#uw.publish('playlist:cycle', {
        userID: next.user.id,
        playlistID: next.playlist.id,
      });
    } else {
      this.#uw.publish('advance:complete', null);
    }
    this.#uw.publish('waitlist:update', await waitlist.getUserIDs());
  }

  /**
   * @param {{ user: User, media: { sourceID: string, sourceType: string } }} entry
   */
  async #getSourceDataForPlayback(entry) {
    const { sourceID, sourceType } = entry.media;
    const source = this.#uw.source(sourceType);
    if (source) {
      this.#logger.trace({ sourceType: source.type, sourceID }, 'running pre-play hook');
      /** @type {JsonObject | undefined} */
      let sourceData;
      try {
        sourceData = await source.play(entry.user, entry.media);
        this.#logger.trace({ sourceType: source.type, sourceID, sourceData }, 'pre-play hook result');
      } catch (error) {
        this.#logger.error({ sourceType: source.type, sourceID, err: error }, 'pre-play hook failed');
      }
      return sourceData;
    }

    return undefined;
  }

  /**
   * @typedef {object} AdvanceOptions
   * @prop {boolean} [remove]
   * @prop {boolean} [publish]
   * @prop {import('redlock').RedlockAbortSignal} [signal]
   * @param {AdvanceOptions} [opts]
   * @returns {Promise<{
   *   historyEntry: HistoryEntry,
   *   user: User,
   *   media: Media,
   *   playlist: Playlist,
   * }|null>}
   */
  async #advanceLocked(opts = {}, tx = this.#uw.db) {
    const { playlists } = this.#uw;

    const publish = opts.publish ?? true;
    const removeAfterCurrent = (await this.#uw.keyv.delete(KEY_REMOVE_AFTER_CURRENT_PLAY)) === true;
    const remove = opts.remove || removeAfterCurrent || (
      !await this.#uw.waitlist.isCycleEnabled()
    );

    const previous = await this.getCurrentEntry(tx);
    let next;
    try {
      next = await this.#getNextEntry({ remove });
    } catch (err) {
      // If the next user's playlist was empty, remove them from the waitlist
      // and try advancing again.
      if (err instanceof EmptyPlaylistError) {
        this.#logger.info('user has empty playlist, skipping on to the next');
        const previousDJ = previous != null ? previous.historyEntry.userID : null;
        await this.#cycleWaitlist(previousDJ, { remove });
        return this.#advanceLocked({ publish, remove: true }, tx);
      }
      throw err;
    }

    if (opts.signal?.aborted) {
      throw opts.signal.error;
    }

    if (previous) {
      this.#logger.info({
        id: previous.historyEntry.id,
        artist: previous.media.artist,
        title: previous.media.title,
        upvotes: previous.upvotes.length,
        favorites: previous.favorites.length,
        downvotes: previous.downvotes.length,
      }, 'previous track stats');
    }

    let result = null;
    if (next != null) {
      this.#logger.info({
        id: next.playlistItem.id,
        artist: next.playlistItem.artist,
        title: next.playlistItem.title,
      }, 'next track');
      const sourceData = await this.#getSourceDataForPlayback(next);

      // Conservatively, we should take *all* the data from the inserted values.
      // But then we need to reparse the source data... It's easier to only take
      // the actually generated value from there :')
      const { createdAt } = await tx.insertInto('historyEntries')
        .returning('createdAt')
        .values({
          id: next.historyEntry.id,
          userID: next.user.id,
          mediaID: next.media.id,
          artist: next.historyEntry.artist,
          title: next.historyEntry.title,
          start: next.historyEntry.start,
          end: next.historyEntry.end,
          sourceData: sourceData != null ? jsonb(sourceData) : null,
        })
        .executeTakeFirstOrThrow();

      if (sourceData != null) {
        next.historyEntry.sourceData = sourceData;
      }
      next.historyEntry.createdAt = createdAt;

      result = {
        historyEntry: next.historyEntry,
        playlist: next.playlist,
        user: next.user,
        media: next.media,
      };
    } else {
      this.#maybeStop();
    }

    await this.#cycleWaitlist(previous != null ? previous.historyEntry.userID : null, { remove });

    if (next) {
      await this.#update(next);
      await playlists.cyclePlaylist(next.playlist, tx);
      this.#play(next.historyEntry);
    } else {
      await this.clear();
    }

    if (publish !== false) {
      await this.#publishAdvanceComplete(result);
    }

    return result;
  }

  /**
   * @param {AdvanceOptions} [opts]
   */
  advance(opts = {}) {
    const result = this.#mutex.withLock(() => {
      const signal = AbortSignal.timeout(10_000);
      return this.#advanceLocked({ ...opts, signal });
    });
    this.#awaitAdvance = result;
    return result;
  }

  /**
   * @param {User} user
   * @param {boolean} remove
   */
  async setRemoveAfterCurrentPlay(user, remove) {
    const newValue = await this.#uw.db.transaction().execute(async (tx) => {
      const currentDJ = /** @type {UserID|undefined} */ (
        await this.#uw.keyv.get(KEY_CURRENT_DJ_ID, tx)
      );
      if (currentDJ === user.id) {
        if (remove) {
          await this.#uw.keyv.set(KEY_REMOVE_AFTER_CURRENT_PLAY, true, tx);
          return true;
        }
        await this.#uw.keyv.delete(KEY_REMOVE_AFTER_CURRENT_PLAY, tx);
        return false;
      } else {
        throw new Error('You are not currently playing');
      }
    });
    return newValue;
  }

  /**
   * @param {User} user
   */
  async getRemoveAfterCurrentPlay(user, tx = this.#uw.db) {
    const currentDJ = /** @type {UserID|undefined} */ (
      await this.#uw.keyv.get(KEY_CURRENT_DJ_ID, tx)
    );
    const removeAfterCurrentPlay = /** @type {boolean|undefined} */ (
      await this.#uw.keyv.get(KEY_REMOVE_AFTER_CURRENT_PLAY, tx)
    );

    if (currentDJ === user.id) {
      return removeAfterCurrentPlay != null;
    }
    return null;
  }
}

/**
 * @param {import('../Uwave.js').Boot} uw
 */
async function boothPlugin(uw) {
  uw.booth = new Booth(uw);
  uw.httpApi.use('/booth', routes());

  uw.after(async (err) => {
    if (!err) {
      await uw.booth.onStart();
    }
  });
}

export default boothPlugin;
export { Booth };
