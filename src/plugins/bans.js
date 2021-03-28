'use strict';

const { clamp } = require('lodash');
const escapeStringRegExp = require('escape-string-regexp');
const Page = require('../Page');

/**
 * @typedef {import('mongodb').ObjectID} ObjectId
 * @typedef {import('../models/User').User} User
 */

/**
 * @param {User} user
 */
function isValidBan(user) {
  return !!(user.banned && +user.banned.expiresAt > Date.now());
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
   * @param {string|ObjectId|User} userID A user object or ID.
   */
  async isBanned(userID) {
    const { users } = this.uw;

    const user = await users.getUser(userID);
    return isValidBan(user);
  }

  /**
   * List banned users.
   *
   * @param {string} filter Optional filter to search for usernames.
   * @param {object} pagination A pagination object.
   * @return {Promise<Page>}
   */
  async getBans(filter = null, pagination = {}) {
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
   * @param {string} userID
   * @param {object} options
   * @param {number} options.duration
   * @param {User} options.moderator
   * @param {boolean} [options.permanent]
   * @param {string} [options.reason]
   */
  async ban(userID, {
    duration, moderator, permanent = false, reason = '',
  }) {
    const { users } = this.uw;

    const user = await users.getUser(userID);
    if (!user) throw new Error('User not found.');

    if (duration <= 0 && !permanent) {
      throw new Error('Ban duration should be at least 0ms.');
    }

    user.banned = {
      duration: permanent ? -1 : duration,
      expiresAt: permanent ? null : new Date(Date.now() + duration),
      moderator: moderator._id,
      reason,
    };

    await user.save();
    await user.populate('banned.moderator').execPopulate();

    this.uw.publish('user:ban', {
      userID: user.id,
      // @ts-ignore `moderator.id` is made available by the `execPopulate()`
      // call above.
      moderatorID: user.banned.moderator.id,
      duration: user.banned.duration,
      expiresAt: +user.banned.expiresAt,
      permanent,
    });

    return user.banned;
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
      throw new Error('User not found.');
    }
    if (!user.banned) {
      throw new Error(`User "${user.username}" is not banned.`);
    }

    user.banned = null;
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
