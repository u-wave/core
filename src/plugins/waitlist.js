'use strict';

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

const schema = require('../schemas/waitlist.json');

/**
 * @typedef {import('../models').User} User
 *
 * @typedef {{ cycle: boolean, locked: boolean }} WaitlistSettings
 */

const ADD_TO_WAITLIST_SCRIPT = /** @type {[string, number, ...string[]]} */ ([
  `
    local k_waitlist = KEYS[1]
    local k_dj = KEYS[2]
    local user_id = ARGV[1]
    local position = ARGV[2]
    local is_in_waitlist = redis.call('LPOS', k_waitlist, user_id)
    local current_dj = redis.call('GET', k_dj)
    if is_in_waitlist or current_dj == user_id then
      return {'${AlreadyInWaitlistError.code}', nil}
    end

    local before_id = nil
    if position then
      before_id = redis.call('LINDEX', k_waitlist, position)
    end

    if before_id then
      redis.call('LINSERT', k_waitlist, 'BEFORE', before_id)
    else
      redis.call('RPUSH', k_waitlist, user_id)
    end

    return {nil, redis.call('LRANGE', k_waitlist, 0, -1)}
  `,
  2,
  'waitlist',
  'booth:currentDJ',
]);

const MOVE_WAITLIST_SCRIPT = /** @type {[string, number, ...string[]]} */ ([
  `
    local k_waitlist = KEYS[1]
    local k_dj = KEYS[2]
    local user_id = ARGV[1]
    local position = ARGV[2]
    local is_in_waitlist = redis.call('LPOS', k_waitlist, user_id)
    if not is_in_waitlist then
      return {'${UserNotInWaitlistError.code}', nil}
    end
    local current_dj = redis.call('GET', k_dj)
    if current_dj == user_id then
      return {'${UserIsPlayingError.code}', nil}
    end

    local before_id = redis.call('LINDEX', k_waitlist, position)

    redis.call('LREM', k_waitlist, 0, user_id);
    if before_id then
      redis.call('LINSERT', k_waitlist, 'BEFORE', before_id, user_id);
    else
      redis.call('RPUSH', k_waitlist, user_id)
    end

    return {nil, redis.call('LRANGE', k_waitlist, 0, -1)}
  `,
  2,
  'waitlist',
  'booth:currentDJ',
]);

class Waitlist {
  #uw;

  /**
   * @param {import('../Uwave').Boot} uw
   */
  constructor(uw) {
    this.#uw = uw;

    uw.config.register(schema['uw:key'], schema);

    const unsubscribe = uw.config.subscribe(
      schema['uw:key'],
      /**
       * @param {WaitlistSettings} _settings
       * @param {string|null} userID
       * @param {Partial<WaitlistSettings>} patch
       */
      (_settings, userID, patch) => {
        // TODO This userID != null check is wrong. It should always pass as
        // long as all the cases where waitlist settings can be updated provide
        // the moderator's user ID. There's no type level guarantee of that happening
        // though and if it doesn't, clients will get out of sync because of this check.
        if ('locked' in patch && patch.locked != null && userID != null) {
          this.#uw.publish('waitlist:lock', {
            moderatorID: userID,
            locked: patch.locked,
          });
        }
      },
    );
    uw.onClose(unsubscribe);
  }

  async #isBoothEmpty() {
    return !(await this.#uw.redis.get('booth:historyID'));
  }

  /**
   * @param {User} user
   * @returns {Promise<boolean>}
   */
  async #hasPlayablePlaylist(user) {
    const { playlists } = this.#uw;
    if (!user.activePlaylist) {
      return false;
    }

    const playlist = await playlists.getUserPlaylist(user, user.activePlaylist);
    return playlist && playlist.size > 0;
  }

  /**
   * @returns {Promise<WaitlistSettings>}
   */
  async #getSettings() {
    const { config } = this.#uw;

    const settings = /** @type {WaitlistSettings} */ (await config.get(schema['uw:key']));
    return settings;
  }

  /**
   * @returns {Promise<boolean>}
   */
  async isLocked() {
    const settings = await this.#getSettings();
    return settings.locked;
  }

  /**
   * @returns {Promise<boolean>}
   */
  async isCycleEnabled() {
    const settings = await this.#getSettings();
    return settings.cycle;
  }

  /**
   * @returns {Promise<string[]>}
   */
  getUserIDs() {
    return this.#uw.redis.lrange('waitlist', 0, -1);
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
    const { acl, users } = this.#uw;

    const user = await users.getUser(userID);
    if (!user) throw new UserNotFoundError({ id: userID });

    const isAddingOtherUser = moderator && user.id !== moderator.id;
    if (isAddingOtherUser) {
      if (!(await acl.isAllowed(moderator, 'waitlist.add'))) {
        throw new PermissionError({
          requiredRole: 'waitlist.add',
        });
      }
    }

    const canForceJoin = await acl.isAllowed(user, 'waitlist.join.locked');
    if (!isAddingOtherUser && !canForceJoin && await this.isLocked()) {
      throw new WaitlistLockedError();
    }

    if (!(await this.#hasPlayablePlaylist(user))) {
      throw new EmptyPlaylistError();
    }

    const [code, waitlist] = (
      /** @type {[AlreadyInWaitlistError['code'], null] | [null, string[]]} */ (
        await this.#uw.redis.eval(...ADD_TO_WAITLIST_SCRIPT, user.id)
      )
    );
    if (code === AlreadyInWaitlistError.code) {
      throw new AlreadyInWaitlistError();
    }

    if (isAddingOtherUser) {
      this.#uw.publish('waitlist:add', {
        userID: user.id,
        moderatorID: moderator.id,
        position: waitlist.indexOf(user.id),
        waitlist,
      });
    } else {
      this.#uw.publish('waitlist:join', {
        userID: user.id,
        waitlist,
      });
    }

    if (await this.#isBoothEmpty()) {
      await this.#uw.booth.advance();
    }
  }

  /**
   * @param {string} userID
   * @param {number} position
   * @param {{moderator: User}} options
   * @returns {Promise<void>}
   */
  async moveUser(userID, position, { moderator }) {
    const { users } = this.#uw;

    const user = await users.getUser(userID.toLowerCase());
    if (!user) {
      throw new UserNotFoundError({ id: userID });
    }

    if (!(await this.#hasPlayablePlaylist(user))) {
      throw new EmptyPlaylistError();
    }

    const [code, waitlist] = (
      /**
       * @type {
       *   | [UserNotInWaitlistError['code'], null]
       *   | [UserIsPlayingError['code'], null]
       *   | [null, string[]]
       * }
       */ (
        await this.#uw.redis.eval(...MOVE_WAITLIST_SCRIPT, user.id, position)
      )
    );
    if (code === UserNotInWaitlistError.code) {
      throw new UserNotInWaitlistError({ id: user.id });
    }
    if (code === UserIsPlayingError.code) {
      throw new UserIsPlayingError({ id: user.id });
    }

    this.#uw.publish('waitlist:move', {
      userID: user.id,
      moderatorID: moderator.id,
      position: waitlist.indexOf(user.id),
      waitlist,
    });
  }

  /**
   * @param {string} userID
   * @param {{moderator: User}} options
   * @returns {Promise<void>}
   */
  async removeUser(userID, { moderator }) {
    const { acl, users } = this.#uw;
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

    const removedCount = await this.#uw.redis.lrem('waitlist', 0, user.id);
    if (removedCount === 0) {
      throw new UserNotInWaitlistError({ id: user.id });
    }

    const waitlist = await this.getUserIDs();
    if (isRemoving) {
      this.#uw.publish('waitlist:remove', {
        userID: user.id,
        moderatorID: moderator.id,
        waitlist,
      });
    } else {
      this.#uw.publish('waitlist:leave', {
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
    await this.#uw.redis.del('waitlist');

    const waitlist = await this.getUserIDs();
    if (waitlist.length !== 0) {
      throw new Error('Could not clear the waitlist. Please try again.');
    }

    this.#uw.publish('waitlist:clear', {
      moderatorID: moderator.id,
    });
  }

  /**
   * @param {boolean} lock
   * @param {User} moderator
   * @returns {Promise<void>}
   */
  async #setWaitlistLocked(lock, moderator) {
    const settings = await this.#getSettings();
    await this.#uw.config.set(schema['uw:key'], { ...settings, locked: lock }, { user: moderator });
  }

  /**
   * Lock the waitlist. Only users with the `waitlist.join.locked` permission
   * will be able to join.
   *
   * @param {{moderator: User}} options
   * @returns {Promise<void>}
   */
  lock({ moderator }) {
    return this.#setWaitlistLocked(true, moderator);
  }

  /**
   * Unlock the waitlist. All users with the `waitlist.join` permission
   * will be able to join.
   *
   * @param {{moderator: User}} options
   * @returns {Promise<void>}
   */
  unlock({ moderator }) {
    return this.#setWaitlistLocked(false, moderator);
  }
}

/**
 * @param {import('../Uwave').Boot} uw
 * @returns {Promise<void>}
 */
async function waitlistPlugin(uw) {
  uw.waitlist = new Waitlist(uw); // eslint-disable-line no-param-reassign
  uw.httpApi.use('/waitlist', routes());
}

module.exports = waitlistPlugin;
module.exports.Waitlist = Waitlist;
