'use strict';

const { clamp } = require('lodash');
const NotFoundError = require('../errors/NotFoundError');
const PermissionError = require('../errors/PermissionError');
const { UserNotFoundError, EmptyPlaylistError } = require('../errors');
const routes = require('../routes/waitlist');

/**
 * @typedef {import('../Uwave')} Uwave
 */

/**
 * @typedef {object} User
 */

/**
 * @param {string[]} waitlist
 * @param {string} userID
 * @return {boolean}
 */
function isInWaitlist(waitlist, userID) {
  return waitlist.some((waitingID) => waitingID === userID);
}

class Waitlist {
  /**
   * @param {Uwave} uw
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
   * @return {Promise<boolean>}
   * @private
   */
  async isCurrentDJ(userID) {
    const dj = await this.getCurrentDJ();
    return dj !== null && dj === userID;
  }

  /**
   * @param {User} user
   * @return {Promise<boolean>}
   * @private
   */
  async hasPlayablePlaylist(user) {
    const { playlists } = this.uw;
    const playlist = await playlists.getUserPlaylist(user, user.activePlaylist);
    return playlist && playlist.size > 0;
  }

  /**
   * @return {Promise<boolean>}
   */
  isLocked() {
    return this.uw.redis.get('waitlist:lock').then(Boolean);
  }

  /**
   * @return {Promise<string[]>}
   */
  getUserIDs() {
    return this.uw.redis.lrange('waitlist', 0, -1);
  }

  /**
   * POST waitlist/ handler for joining the waitlist.
   *
   * @return {Promise<string[]>}
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
   * @return {Promise<string[]>}
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
   * @return {Promise<void>}
   */
  async addUser(userID, { moderator } = {}) {
    const { acl, users } = this.uw;

    const user = await users.getUser(userID);
    if (!user) throw new UserNotFoundError({ id: userID });

    const canForceJoin = await acl.isAllowed(user, 'waitlist.join.locked');
    if (!canForceJoin && await this.isLocked()) {
      throw new PermissionError('The waitlist is locked. Only staff can join.', {
        requiredRole: 'waitlist.join.locked',
      });
    }

    let waitlist = await this.getUserIDs();
    if (isInWaitlist(waitlist, user.id)) {
      throw new PermissionError('You are already in the waitlist.');
    }
    if (await this.isCurrentDJ(user.id)) {
      throw new PermissionError('You are already currently playing.');
    }
    if (!(await this.hasPlayablePlaylist(user))) {
      throw new EmptyPlaylistError();
    }

    if (!moderator || user.id === moderator.id) {
      waitlist = await this.doJoinWaitlist(user);
    } else {
      if (!(await acl.isAllowed(moderator, 'waitlist.add'))) {
        throw new PermissionError('You cannot add someone else to the waitlist.', {
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
   * @param {{moderator?: User}} [options]
   * @return {Promise<void>}
   */
  async moveUser(userID, position, { moderator } = {}) {
    const { users } = this.uw;

    const user = await users.getUser(userID.toLowerCase());
    if (!user) {
      throw new UserNotFoundError({ id: userID });
    }

    let waitlist = await this.getUserIDs();

    if (!isInWaitlist(waitlist, user.id)) {
      throw new PermissionError('That user is not in the waitlist.');
    }
    if (await this.isCurrentDJ(user.id)) {
      throw new PermissionError('That user is currently playing.');
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
   * @param {{moderator?: User}} [options]
   * @return {Promise<void>}
   */
  async removeUser(userID, { moderator } = {}) {
    const { acl, users } = this.uw;
    const user = await users.getUser(userID);

    const isRemoving = moderator && user.id !== moderator.id;
    if (isRemoving && !(await acl.isAllowed(moderator, 'waitlist.remove'))) {
      throw new PermissionError('You need to be a moderator to do this.', {
        requiredRole: 'waitlist.remove',
      });
    }

    let waitlist = await this.getUserIDs();
    if (!isInWaitlist(waitlist, user.id)) {
      throw new NotFoundError('That user is not in the waitlist.');
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
   * @return {Promise<void>}
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
   * @return {Promise<void>}
   * @private
   */
  async lockWaitlist(lock, moderator) {
    if (lock) {
      await this.uw.redis.set('waitlist:lock', lock);
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
   * @return {Promise<void>}
   */
  lock({ moderator }) {
    return this.lockWaitlist(true, moderator);
  }

  /**
   * @param {{moderator: User}} options
   * @return {Promise<void>}
   */
  unlock({ moderator }) {
    return this.lockWaitlist(false, moderator);
  }
}

/**
 * @return {Promise<void>}
 */
async function waitlistPlugin(uw) {
  uw.waitlist = new Waitlist(uw); // eslint-disable-line no-param-reassign
  uw.httpApi.use('/waitlist', routes());
}

module.exports = waitlistPlugin;
module.exports.Waitlist = Waitlist;
