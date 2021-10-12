'use strict';

/** @typedef {import('../Uwave')} Uwave */
/** @typedef {import('../models').User} User */

/**
 * Data holder for things that source plugins may require.
 */
class SourceContext {
  /**
   * @param {Uwave} uw
   * @param {Source} source
   * @param {User} user
   */
  constructor(uw, source, user) {
    this.uw = uw;
    this.source = source;
    this.user = user;
  }
}

module.exports = SourceContext;
