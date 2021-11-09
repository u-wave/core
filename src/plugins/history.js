'use strict';

const { clamp } = require('lodash');
const Page = require('../Page');

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * @typedef {import('../models/History').HistoryMedia} HistoryMedia
 * @typedef {import('../models').HistoryEntry} HistoryEntry
 * @typedef {import('../models').User} User
 * @typedef {import('../models').Media} Media
 * @typedef {{ media: Media }} PopulateMedia
 * @typedef {{ user: User }} PopulateUser
 * @typedef {HistoryMedia & PopulateMedia} PopulatedHistoryMedia
 * @typedef {{ media: PopulatedHistoryMedia }} PopulateHistoryMedia
 * @typedef {HistoryEntry & PopulateUser & PopulateHistoryMedia} PopulatedHistoryEntry
 */

class HistoryRepository {
  #uw;

  /**
   * @param {import('../Uwave')} uw
   */
  constructor(uw) {
    this.#uw = uw;
  }

  /**
   * @param {object} filter
   * @param {{ offset?: number, limit?: number }} [pagination]
   * @returns {Promise<Page<PopulatedHistoryEntry, { offset: number, limit: number }>>}
   */
  async getHistory(filter, pagination = {}) {
    const { HistoryEntry } = this.#uw.models;

    const offset = pagination.offset || 0;
    const limit = clamp(
      typeof pagination.limit === 'number' ? pagination.limit : DEFAULT_PAGE_SIZE,
      0,
      MAX_PAGE_SIZE,
    );

    const total = await HistoryEntry.where(filter).countDocuments();
    const query = HistoryEntry.where(filter)
      .sort({ playedAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('media.media user');

    /** @type {PopulatedHistoryEntry[]} */
    // @ts-ignore TS2322: `media` and `user` types mismatch because typescript
    // doesn't understand `populate()`.
    const results = await query;

    return new Page(results, {
      pageSize: pagination ? pagination.limit : undefined,
      filtered: total,
      total,
      current: { offset, limit },
      next: pagination ? { offset: offset + limit, limit } : undefined,
      previous: offset > 0
        ? { offset: Math.max(offset - limit, 0), limit }
        : undefined,
    });
  }

  /**
   * @param {{ offset?: number, limit?: number }} [pagination]
   */
  getRoomHistory(pagination = {}) {
    return this.getHistory({}, pagination);
  }

  /**
   * @param {User} user
   * @param {{ offset?: number, limit?: number }} [pagination]
   */
  getUserHistory(user, pagination = {}) {
    return this.getHistory({ user: user._id }, pagination);
  }
}

/**
 * @param {import('../Uwave')} uw
 */
async function history(uw) {
  uw.history = new HistoryRepository(uw);
}

module.exports = history;
module.exports.HistoryRepository = HistoryRepository;
