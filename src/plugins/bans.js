'use strict';

const { clamp } = require('lodash');
const escapeStringRegExp = require('escape-string-regexp');
const {
  UserNotFoundError,
} = require('../errors');
const Page = require('../Page');

/**
 * @typedef {import('mongodb').ObjectID} ObjectID
 * @typedef {import('../models/User').User} User
 */

/**
 * @param {User} user
 */
function isValidBan(user) {
  if (!user.banned) {
    return false;
  }
  // Permanent ban.
  if (!user.banned.expiresAt) {
    return true;
  }
  return user.banned.expiresAt.getTime() > Date.now();
}

class Bans {
  /**
   * @param {import('../Uwave')} uw
   */
  constructor(uw) {
    this.uw = uw;
  }

  /**
   * Check whether a user is currently banned.
   *
   * @param {string|ObjectID|User} userID A user object or ID.
   */
  async isBanned(userID) {
    const { users } = this.uw;

    const user = await users.getUser(userID);
    return isValidBan(user);
  }

  /**
   * List banned users.
   *
   * @param {string} [filter] Optional filter to search for usernames.
   * @param {object} [pagination] A pagination object.
   * @return {Promise<Page>}
   */
  async getBans(filter, pagination = {}) {
    const User = this.uw.model('User');

    const offset = pagination.offset || 0;
    const size = clamp(
      'limit' in pagination ? pagination.limit : 50,
      0, 100,
    );

    const queryFilter = {
      banned: { $ne: null },
      'banned.expiresAt': { $gt: new Date() },
    };
    if (filter) {
      Object.assign(queryFilter, {
        username: { $regex: RegExp(escapeStringRegExp(filter), 'i') },
      });
    }

    const total = await User.find().where(queryFilter).countDocuments();

    /** @type {import('../models/User').LeanUser[]} */
    const bannedUsers = await User.find()
      .where(queryFilter)
      .skip(offset)
      .limit(size)
      .populate('banned.moderator')
      .lean();

    const results = bannedUsers.map((user) => {
      const ban = user.banned;
      delete user.banned; // eslint-disable-line no-param-reassign
      return {
        ...ban,
        user,
      };
    });

    return new Page(results, {
      pageSize: pagination ? pagination.limit : null,
      filtered: total,
      total,
      current: { offset, limit: size },
      next: pagination ? { offset: offset + size, limit: size } : null,
      previous: offset > 0
        ? { offset: Math.max(offset - size, 0), limit: size }
        : null,
    });
  }

  /**
   * @param {User} user
   * @param {object} options
   * @param {number} options.duration
   * @param {User} options.moderator
   * @param {boolean} [options.permanent]
   * @param {string} [options.reason]
   */
  async ban(user, {
    duration, moderator, permanent = false, reason = '',
  }) {
    if (duration <= 0 && !permanent) {
      throw new Error('Ban duration should be at least 0ms.');
    }

    const banned = {
      duration: permanent ? -1 : duration,
      expiresAt: permanent ? undefined : new Date(Date.now() + duration),
      moderator: moderator._id,
      reason,
    };
    user.banned = banned;

    await user.save();
    await user.populate('banned.moderator').execPopulate();

    this.uw.publish('user:ban', {
      userID: user.id,
      moderatorID: moderator.id,
      duration: banned.duration,
      expiresAt: banned.expiresAt ? banned.expiresAt.getTime() : null,
      permanent,
    });

    return {
      ...banned,
      moderator,
    };
  }

  /**
   * @param {string} userID
   * @param {object} options
   * @param {User} options.moderator
   */
  async unban(userID, { moderator }) {
    const { users } = this.uw;

    const user = await users.getUser(userID);
    if (!user) {
      throw new UserNotFoundError({ id: userID });
    }
    if (!user.banned) {
      throw new Error(`User "${user.username}" is not banned.`);
    }

    user.banned = undefined;
    await user.save();

    this.uw.publish('user:unban', {
      userID: `${user.id}`,
      moderatorID: typeof moderator === 'object' ? `${moderator.id}` : moderator,
    });
  }
}

/**
 * @param {import('../Uwave')} uw
 */
async function bans(uw) {
  uw.bans = new Bans(uw); // eslint-disable-line no-param-reassign
}

module.exports = bans;
module.exports.Bans = Bans;
