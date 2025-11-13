import fs from 'node:fs';
import {
  PermissionError,
  UserNotFoundError,
  EmptyPlaylistError,
  WaitlistLockedError,
  AlreadyInWaitlistError,
  UserNotInWaitlistError,
  UserIsPlayingError,
} from '../errors/index.js';
import routes from '../routes/waitlist.js';
import { Permissions } from './acl.js';

const schema = JSON.parse(
  fs.readFileSync(new URL('../schemas/waitlist.json', import.meta.url), 'utf8'),
);

const KEY_WAITLIST = 'waitlist';
const KEY_CURRENT_DJ_ID = 'booth:currentDJ';
const KEY_HISTORY_ID = 'booth:historyID';

/**
 * @typedef {import('../schema.js').UserID} UserID
 * @typedef {import('../schema.js').User} User
 * @typedef {{ cycle: boolean, locked: boolean }} WaitlistSettings
 */

class Waitlist {
  #uw;

  /**
   * @param {import('../Uwave.js').Boot} uw
   */
  constructor(uw) {
    this.#uw = uw;

    uw.config.register(schema['uw:key'], schema);

    const unsubscribe = uw.config.subscribe(
      schema['uw:key'],
      /**
       * @param {WaitlistSettings} _settings
       * @param {UserID|null} userID
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
    return !(await this.#uw.keyv.get(KEY_HISTORY_ID));
  }

  /**
   * @param {User} user
   * @returns {Promise<boolean>}
   */
  async #hasPlayablePlaylist(user, tx = this.#uw.db) {
    const { playlists } = this.#uw;
    if (!user.activePlaylistID) {
      return false;
    }

    const playlist = await playlists.getUserPlaylist(user, user.activePlaylistID, tx);
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
   * @returns {Promise<UserID[]>}
   */
  async getUserIDs(tx = this.#uw.db) {
    const userIDs = /** @type {UserID[] | null} */ (await this.#uw.keyv.get(KEY_WAITLIST, tx));
    return userIDs ?? [];
  }

  /**
   * @param {UserID|null} previous
   * @param {{ remove?: boolean }} options
   */
  async cycle(previous, options) {
    // TODO: This must happen in a transaction
    const waitlist = await this.getUserIDs();
    if (waitlist.length > 0) {
      waitlist.shift();
      if (previous && !options.remove) {
        // The previous DJ should only be added to the waitlist again if it was
        // not empty. If it was empty, the previous DJ is already in the booth.
        waitlist.push(previous);
      }

      await this.#uw.keyv.set(KEY_WAITLIST, waitlist);
    }
  }

  /**
   * Add a user to the waitlist.
   *
   * @param {UserID} userID
   * @param {{moderator?: User}} [options]
   */
  async addUser(userID, options = {}) {
    const { moderator } = options;
    const { acl, users } = this.#uw;

    const user = await users.getUser(userID);
    if (!user) throw new UserNotFoundError({ id: userID });

    const isAddingOtherUser = moderator && user.id !== moderator.id;
    if (isAddingOtherUser) {
      if (!(await acl.isAllowed(moderator, Permissions.WaitlistAdd))) {
        throw new PermissionError({
          requiredRole: 'waitlist.add',
        });
      }
    }

    const canForceJoin = await acl.isAllowed(user, Permissions.WaitlistJoinLocked);
    if (!isAddingOtherUser && !canForceJoin && await this.isLocked()) {
      throw new WaitlistLockedError();
    }

    if (!(await this.#hasPlayablePlaylist(user))) {
      throw new EmptyPlaylistError();
    }

    const waitlist = await this.getUserIDs();
    const isInWaitlist = waitlist.includes(user.id);
    const currentDJ = /** @type {UserID|null} */ (
      await this.#uw.keyv.get(KEY_CURRENT_DJ_ID)
    );
    if (isInWaitlist || currentDJ === user.id) {
      throw new AlreadyInWaitlistError();
    }

    waitlist.push(user.id);

    await this.#uw.keyv.set(KEY_WAITLIST, waitlist);

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
   * @param {UserID} userID
   * @param {number} position
   * @param {{moderator: User}} options
   * @returns {Promise<void>}
   */
  async moveUser(userID, position, { moderator }) {
    const { users } = this.#uw;

    const user = await users.getUser(userID);
    if (!user) {
      throw new UserNotFoundError({ id: userID });
    }

    if (!(await this.#hasPlayablePlaylist(user))) {
      throw new EmptyPlaylistError();
    }

    const waitlist = await this.getUserIDs();
    const previousPosition = waitlist.indexOf(user.id);
    if (previousPosition === -1) {
      throw new UserNotInWaitlistError({ id: user.id });
    }
    const currentDJ = /** @type {UserID|null} */ (
      await this.#uw.keyv.get(KEY_CURRENT_DJ_ID)
    );
    if (currentDJ === user.id) {
      throw new UserIsPlayingError({ id: user.id });
    }

    waitlist.splice(previousPosition, 1);
    waitlist.splice(position, 0, user.id);

    await this.#uw.keyv.set(KEY_WAITLIST, waitlist);

    this.#uw.publish('waitlist:move', {
      userID: user.id,
      moderatorID: moderator.id,
      position: waitlist.indexOf(user.id),
      waitlist,
    });
  }

  /**
   * @param {UserID} userID
   * @param {{moderator?: User}} [options]
   * @returns {Promise<void>}
   */
  async removeUser(userID, { moderator } = {}) {
    const { acl, users } = this.#uw;
    const user = await users.getUser(userID);
    if (!user) {
      throw new UserNotFoundError({ id: userID });
    }

    const isRemoving = moderator != null && user.id !== moderator.id;
    if (isRemoving && !(await acl.isAllowed(moderator, Permissions.WaitlistRemove))) {
      throw new PermissionError({
        requiredRole: 'waitlist.remove',
      });
    }

    const waitlist = await this.#uw.db.transaction().execute(async (tx) => {
      const waitlist = await this.getUserIDs(tx);
      let index;
      let removedCount = 0;
      while ((index = waitlist.indexOf(user.id)) !== -1) {
        waitlist.splice(index, 1);
        removedCount += 1;
      }

      if (removedCount === 0) {
        throw new UserNotInWaitlistError({ id: user.id });
      }

      await this.#uw.keyv.set(KEY_WAITLIST, waitlist, tx);
      return waitlist;
    });

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
    await this.#uw.keyv.delete(KEY_WAITLIST);

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
 * @param {import('../Uwave.js').Boot} uw
 * @returns {Promise<void>}
 */
async function waitlistPlugin(uw) {
  uw.waitlist = new Waitlist(uw);
  uw.httpApi.use('/waitlist', routes());
}

export default waitlistPlugin;
export { Waitlist };
