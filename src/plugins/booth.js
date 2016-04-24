import Promise from 'bluebird';
import { Types as MongoTypes } from 'mongoose';

const debug = require('debug')('uwave:advance');

const ObjectId = MongoTypes.ObjectId;

export class Booth {
  timeout: ?number = null;

  constructor(uw) {
    this.uw = uw;

    uw.on('started', this.onStart.bind(this));
    uw.on('stop', this.onStop.bind(this));
  }

  async onStart() {
    const current = await this.getCurrentEntry();
    if (current && this.timeout === null) {
      // Restart the advance timer after a server restart, if a track was
      // playing before the server restarted.
      const duration = (current.media.end - current.media.start) * 1000;
      const endTime = Number(current.playedAt) + duration;
      if (endTime > Date.now()) {
        this.timeout = setTimeout(
          () => this.uw.advance(),
          endTime - Date.now()
        );
      } else {
        this.uw.advance();
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

    return await History.findOne(new ObjectId(historyID));
  }

  async saveStats(entry) {
    const stats = await Promise.props({
      upvotes: this.uw.redis.lrange('booth:upvotes', 0, -1),
      downvotes: this.uw.redis.lrange('booth:downvotes', 0, -1),
      favorites: this.uw.redis.lrange('booth:favorites', 0, -1)
    });

    Object.assign(entry, stats);
    return await entry.save();
  }

  async cyclePlaylist(playlist) {
    const item = playlist.media.shift();
    playlist.media.push(item);
    return await playlist.save();
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

    return await User.findOne(new ObjectId(userID));
  }

  async getNextEntry(opts) {
    const HistoryEntry = this.uw.model('History');

    const user = await this.getNextDJ(opts);
    if (!user) {
      return null;
    }
    const playlist = await user.getActivePlaylist();
    const playlistItem = await playlist.getItemAt(0);

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
        end: playlistItem.end
      }
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
      'booth:favorites'
    ]);
  }

  update(next) {
    return Promise.all([
      this.uw.redis.del([
        'booth:upvotes',
        'booth:downvotes',
        'booth:favorites'
      ]),
      this.uw.redis.set('booth:historyID', next.id),
      this.uw.redis.set('booth:currentDJ', next.user.id)
    ]);
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
      () => this.uw.advance(),
      (entry.media.end - entry.media.start) * 1000
    );
    return entry;
  }

  getWaitlist() {
    return this.uw.redis.lrange('waitlist', 0, -1);
  }

  async publish(next) {
    if (next) {
      this.uw.publish('advance:complete', next);
      this.uw.publish('playlist:cycle', {
        userID: next.user.id,
        playlistID: next.playlist.id
      });
    } else {
      this.uw.publish('advance:complete', null);
    }
    this.uw.publish('waitlist:update', await this.getWaitlist());
  }

  async advance(opts = {}) {
    const previous = await this.getCurrentEntry();
    const next = await this.getNextEntry(opts);

    if (previous) {
      await this.saveStats(previous);

      debug('previous track:', previous.media.artist, '—', previous.media.title,
        `👍 ${previous.upvotes.length} ` +
        `★ ${previous.favorites.length} ` +
        `👎 ${previous.downvotes.length}`
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
      await this.cyclePlaylist(next.playlist);
      await this.play(next);
    } else {
      await this.clear();
    }

    if (opts.publish !== false) {
      await this.publish(next);
    }

    return next;
  }
}

export default function booth() {
  return uw => {
    uw.booth = new Booth(uw); // eslint-disable-line no-param-reassign
  };
}
