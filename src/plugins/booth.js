'use strict';

const ms = require('ms');
const RedLock = require('redlock');
const createDebug = require('debug');
const routes = require('../routes/booth');

class PlaylistIsEmptyError extends Error {
  constructor(message) {
    super(message);
    this.code = 'PLAYLIST_IS_EMPTY';
  }
}

const debug = createDebug('uwave:advance');

function cyclePlaylist(playlist) {
  const item = playlist.media.shift();
  playlist.media.push(item);
  return playlist.save();
}

class Booth {
  constructor(uw) {
    this.uw = uw;
    this.timeout = null;
  }

  async onStart() {
    this.locker = new RedLock([this.uw.redis]);

    const current = await this.getCurrentEntry();
    if (current && this.timeout === null) {
      // Restart the advance timer after a server restart, if a track was
      // playing before the server restarted.
      const duration = (current.media.end - current.media.start) * ms('1 second');
      const endTime = Number(current.playedAt) + duration;
      if (endTime > Date.now()) {
        this.timeout = setTimeout(
          () => this.advance(),
          endTime - Date.now(),
        );
      } else {
        this.advance();
      }
    }
  }

  onStop() {
    this.maybeStop();
  }

  async getCurrentEntry() {
    const History = this.uw.model('History');
    const historyID = await this.uw.redis.get('booth:historyID');
    if (!historyID) {
      return null;
    }

    return History.findById(historyID);
  }

  async getCurrentVoteStats() {
    const { redis } = this.uw;

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

  async saveStats(entry) {
    const stats = await this.getCurrentVoteStats();

    Object.assign(entry, stats);
    return entry.save();
  }

  async getNextDJ(opts) {
    const User = this.uw.model('User');
    let userID = await this.uw.redis.lindex('waitlist', 0);
    if (!userID && !opts.remove) {
      // If the waitlist is empty, the current DJ will play again immediately.
      userID = await this.uw.redis.get('booth:currentDJ');
    }
    if (!userID) {
      return null;
    }

    return User.findById(userID);
  }

  async getNextEntry(opts) {
    const { HistoryEntry } = this.uw.models;
    const { playlists } = this.uw;

    const user = await this.getNextDJ(opts);
    if (!user) {
      return null;
    }
    const playlist = await playlists.getUserPlaylist(user, user.activePlaylist);
    if (playlist.size === 0) {
      throw new PlaylistIsEmptyError();
    }
    const playlistItem = await playlists.getPlaylistItem(playlist.media[0]);

    await playlistItem.populate('media').execPopulate();

    return new HistoryEntry({
      user,
      playlist,
      item: playlistItem,
      media: {
        media: playlistItem.media,
        artist: playlistItem.artist,
        title: playlistItem.title,
        start: playlistItem.start,
        end: playlistItem.end,
      },
    });
  }

  async cycleWaitlist(previous, opts) {
    const waitlistLen = await this.uw.redis.llen('waitlist');
    if (waitlistLen > 0) {
      await this.uw.redis.lpop('waitlist');
      if (previous && !opts.remove) {
        // The previous DJ should only be added to the waitlist again if it was
        // not empty. If it was empty, the previous DJ is already in the booth.
        await this.uw.redis.rpush('waitlist', previous.user);
      }
    }
  }

  clear() {
    return this.uw.redis.del([
      'booth:historyID',
      'booth:currentDJ',
      'booth:upvotes',
      'booth:downvotes',
      'booth:favorites',
    ]);
  }

  update(next) {
    return this.uw.redis.multi()
      .del(['booth:upvotes', 'booth:downvotes', 'booth:favorites'])
      .set('booth:historyID', next.id)
      .set('booth:currentDJ', next.user.id)
      .exec();
  }

  maybeStop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  play(entry) {
    this.maybeStop();
    this.timeout = setTimeout(
      () => this.advance(),
      (entry.media.end - entry.media.start) * ms('1 second'),
    );
    return entry;
  }

  getWaitlist() {
    return this.uw.redis.lrange('waitlist', 0, -1);
  }

  async publish(next) {
    if (next) {
      this.uw.publish('advance:complete', {
        historyID: next.id,
        userID: next.user.id,
        playlistID: next.playlist.id,
        itemID: next.item.id,
        media: next.media,
        playedAt: next.playedAt,
      });
      this.uw.publish('playlist:cycle', {
        userID: next.user.id,
        playlistID: next.playlist.id,
      });
    } else {
      this.uw.publish('advance:complete', null);
    }
    this.uw.publish('waitlist:update', await this.getWaitlist());
  }

  async advance(opts = {}, reuseLock = null) {
    let lock;
    try {
      if (reuseLock) {
        lock = await reuseLock.extend(ms('2 seconds'));
      } else {
        lock = await this.locker.lock('booth:advancing', ms('2 seconds'));
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
      await next.save();
    } else {
      this.maybeStop();
    }

    await this.cycleWaitlist(previous, opts);

    if (next) {
      await this.update(next);
      await cyclePlaylist(next.playlist);
      await this.play(next);
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
