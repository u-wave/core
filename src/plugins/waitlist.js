'use strict';

const { clamp } = require('lodash');
const {
  PermissionError,
  UserNotFoundError,
  EmptyPlaylistError,
  WaitlistLockedError,
  AlreadyInWaitlistError,
  UserNotInWaitlistError,
  UserIsPlayingError,
} = require('../errors');
const routes = require('../routes/waitlist');

/**
 * @typedef {import('../models').User} User
 */

/**
 * @param {string[]} waitlist
 * @param {string} userID
 * @returns {boolean}
 */
function isInWaitlist(waitlist, userID) {
  return waitlist.some((waitingID) => waitingID === userID);
}

class Waitlist {
  /**
   * @param {import('../Uwave')} uw
   */
  constructor(uw) {
    this.uw = uw;
  }

  /**
   * @private
   */
  getCurrentDJ() {
    return this.uw.redis.get('booth:currentDJ');
  }

  /**
   * @private
   */
  async isBoothEmpty() {
    return !(await this.uw.redis.get('booth:historyID'));
  }

  /**
   * @param {string} userID
   * @returns {Promise<boolean>}
   * @private
   */
  async isCurrentDJ(userID) {
    const dj = await this.getCurrentDJ();
    return dj !== null && dj === userID;
  }

  /**
   * @param {User} user
   * @returns {Promise<boolean>}
   * @private
   */
  async hasPlayablePlaylist(user) {
    const { playlists } = this.uw;
    if (!user.activePlaylist) {
      return false;
    }

    const playlist = await playlists.getUserPlaylist(user, user.activePlaylist);
    return playlist && playlist.size > 0;
  }

  /**
   * @returns {Promise<boolean>}
   */
  isLocked() {
    return this.uw.redis.get('waitlist:lock').then(Boolean);
  }

  /**
   * @returns {Promise<string[]>}
   */
  getUserIDs() {
    return this.uw.redis.lrange('waitlist', 0, -1);
  }

  /**
   * POST waitlist/ handler for joining the waitlist.
   *
   * @param {User} user
   * @returns {Promise<string[]>}
   * @private
   */
  async doJoinWaitlist(user) {
    await this.uw.redis.rpush('waitlist', user.id);

    const waitlist = await this.getUserIDs();

    this.uw.publish('waitlist:join', {
      userID: user.id,
      waitlist,
    });

    return waitlist;
  }

  /**
   * POST waitlist/ handler for adding a (different) user to the waitlist.
   *
   * @param {User} user
   * @param {{ moderator: User, waitlist: string[], position: number }} options
   * @returns {Promise<string[]>}
   * @private
   */
  async doAddToWaitlist(user, { moderator, waitlist, position }) {
    const clampedPosition = clamp(position, 0, waitlist.length);

    if (clampedPosition < waitlist.length) {
      await this.uw.redis.linsert('waitlist', 'BEFORE', waitlist[clampedPosition], user.id);
    } else {
      await this.uw.redis.rpush('waitlist', user.id);
    }

    const newWaitlist = await this.getUserIDs();

    this.uw.publish('waitlist:add', {
      userID: user.id,
      moderatorID: moderator.id,
      position: clampedPosition,
      waitlist: newWaitlist,
    });

    return newWaitlist;
  }

  /**
   * used both for joining the waitlist, and for
   * adding someone else to the waitlist.
   * TODO maybe split this up and let http-api handle the difference
   *
   * @param {string} userID
   * @param {{moderator?: User}} [options]
   * @returns {Promise<void>}
   */
  async addUser(userID, { moderator } = {}) {
    const { acl, users } = this.uw;

    const user = await users.getUser(userID);
    if (!user) throw new UserNotFoundError({ id: userID });

    const canForceJoin = await acl.isAllowed(user, 'waitlist.join.locked');
    if (!canForceJoin && await this.isLocked()) {
      throw new WaitlistLockedError();
    }

    let waitlist = await this.getUserIDs();
    if (isInWaitlist(waitlist, user.id)) {
      throw new AlreadyInWaitlistError();
    }
    if (await this.isCurrentDJ(user.id)) {
      throw new AlreadyInWaitlistError();
    }
    if (!(await this.hasPlayablePlaylist(user))) {
      throw new EmptyPlaylistError();
    }

    if (!moderator || user.id === moderator.id) {
      waitlist = await this.doJoinWaitlist(user);
    } else {
      if (!(await acl.isAllowed(moderator, 'waitlist.add'))) {
        throw new PermissionError({
          requiredRole: 'waitlist.add',
        });
      }
      waitlist = await this.doAddToWaitlist(user, {
        moderator,
        waitlist,
        position: waitlist.length,
      });
    }

    if (await this.isBoothEmpty()) {
      await this.uw.booth.advance();
    }
  }

  /**
   * @param {string} userID
   * @param {number} position
   * @param {{moderator: User}} options
   * @returns {Promise<void>}
   */
  async moveUser(userID, position, { moderator }) {
    const { users } = this.uw;

    const user = await users.getUser(userID.toLowerCase());
    if (!user) {
      throw new UserNotFoundError({ id: userID });
    }

    let waitlist = await this.getUserIDs();

    if (!isInWaitlist(waitlist, user.id)) {
      throw new UserNotInWaitlistError({ id: user.id });
    }
    if (await this.isCurrentDJ(user.id)) {
      throw new UserIsPlayingError({ id: user.id });
    }
    if (!(await this.hasPlayablePlaylist(user))) {
      throw new EmptyPlaylistError();
    }

    const clampedPosition = clamp(position, 0, waitlist.length);
    const beforeID = waitlist[clampedPosition] || null;

    if (beforeID === user.id) {
      // No change.
      return;
    }

    await this.uw.redis.lrem('waitlist', 0, user.id);
    if (beforeID) {
      await this.uw.redis.linsert('waitlist', 'BEFORE', beforeID, user.id);
    } else {
      await this.uw.redis.rpush('waitlist', user.id);
    }

    waitlist = await this.getUserIDs();

    this.uw.publish('waitlist:move', {
      userID: user.id,
      moderatorID: moderator.id,
      position: clampedPosition,
      waitlist,
    });
  }

  /**
   * @param {string} userID
   * @param {{moderator: User}} options
   * @returns {Promise<void>}
   */
  async removeUser(userID, { moderator }) {
    const { acl, users } = this.uw;
    const user = await users.getUser(userID);
    if (!user) {
      throw new UserNotFoundError({ id: userID });
    }

    const isRemoving = moderator && user.id !== moderator.id;
    if (isRemoving && !(await acl.isAllowed(moderator, 'waitlist.remove'))) {
      throw new PermissionError({
        requiredRole: 'waitlist.remove',
      });
    }

    let waitlist = await this.getUserIDs();
    if (!isInWaitlist(waitlist, user.id)) {
      throw new UserNotInWaitlistError({ id: user.id });
    }

    await this.uw.redis.lrem('waitlist', 0, user.id);

    waitlist = await this.getUserIDs();
    if (isRemoving) {
      this.uw.publish('waitlist:remove', {
        userID: user.id,
        moderatorID: moderator.id,
        waitlist,
      });
    } else {
      this.uw.publish('waitlist:leave', {
        userID: user.id,
        waitlist,
      });
    }
  }

  /**
   * @param {{moderator: User}} options
   * @returns {Promise<void>}
   */
  async clear({ moderator }) {
    await this.uw.redis.del('waitlist');

    const waitlist = await this.getUserIDs();
    if (waitlist.length !== 0) {
      throw new Error('Could not clear the waitlist. Please try again.');
    }

    this.uw.publish('waitlist:clear', {
      moderatorID: moderator.id,
    });
  }

  /**
   * @param {boolean} lock
   * @param {User} moderator
   * @returns {Promise<void>}
   * @private
   */
  async lockWaitlist(lock, moderator) {
    if (lock) {
      await this.uw.redis.set('waitlist:lock', String(lock));
    } else {
      await this.uw.redis.del('waitlist:lock');
    }

    const isLocked = await this.isLocked();

    if (isLocked !== lock) {
      throw new Error(`Could not ${lock ? 'lock' : 'unlock'} the waitlist. Please try again.`);
    }

    this.uw.publish('waitlist:lock', {
      moderatorID: moderator.id,
      locked: isLocked,
    });
  }

  /**
   * @param {{moderator: User}} options
   * @returns {Promise<void>}
   */
  lock({ moderator }) {
    return this.lockWaitlist(true, moderator);
  }

  /**
   * @param {{moderator: User}} options
   * @returns {Promise<void>}
   */
  unlock({ moderator }) {
    return this.lockWaitlist(false, moderator);
  }
}

/**
 * @param {import('../Uwave')} uw
 * @returns {Promise<void>}
 */
async function waitlistPlugin(uw) {
  uw.waitlist = new Waitlist(uw); // eslint-disable-line no-param-reassign
  uw.httpApi.use('/waitlist', routes());
}

module.exports = waitlistPlugin;
module.exports.Waitlist = Waitlist;
