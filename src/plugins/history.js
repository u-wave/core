'use strict';

const { clamp } = require('lodash');

const Page = require('../Page');

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * @typedef {import('../models').User} User
 */

class HistoryRepository {
  /**
   * @param {import('../Uwave')} uw
   */
  constructor(uw) {
    this.uw = uw;
  }

  /**
   * @param {object} filter
   * @param {{ offset?: number, limit?: number }} [pagination]
   */
  async getHistory(filter, pagination = {}) {
    const { HistoryEntry } = this.uw.models;

    const offset = pagination.offset || 0;
    const size = clamp(
      'limit' in pagination ? pagination.limit : DEFAULT_PAGE_SIZE,
      0, MAX_PAGE_SIZE,
    );

    const total = await HistoryEntry.where(filter).countDocuments();
    const results = await HistoryEntry.where(filter)
      .sort({ playedAt: -1 })
      .skip(offset)
      .limit(size)
      .populate('media.media user');

    return new Page(results, {
      pageSize: pagination ? pagination.limit : null,
      filtered: total,
      total,
      current: { offset, limit: size },
      next: pagination ? { offset: offset + size, limit: size } : null,
      previous: offset > 0
        ? { offset: Math.max(offset - size, 0), limit: size }
        : null,
      results,
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

async function history(uw) {
  uw.history = new HistoryRepository(uw);
}

module.exports = history;
module.exports.HistoryRepository = HistoryRepository;
