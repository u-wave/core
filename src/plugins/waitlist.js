import { clamp } from 'lodash';
import NotFoundError from '../errors/NotFoundError';
import PermissionError from '../errors/PermissionError';

function isInWaitlist(waitlist, userID) {
  return waitlist.some(waitingID => waitingID === userID);
}

class Waitlist {
  constructor(uw) {
    this.uw = uw;
  }

  #getCurrentDJ = () => this.uw.redis.get('booth:currentDJ')

  #isBoothEmpty = async () => !(await this.uw.redis.get('booth:historyID'))

  #isCurrentDJ = async (userID: string) => {
    const dj = await this.#getCurrentDJ();
    return dj !== null && dj === userID;
  }

  #hasValidPlaylist = async (userID) => {
    const { users } = this.uw;
    const user = await users.getUser(userID);
    const playlist = await user.getActivePlaylist();
    return playlist && playlist.size > 0;
  }

  isLocked() {
    return this.uw.redis.get('waitlist:lock').then(Boolean);
  }

  getUserIDs() {
    return this.uw.redis.lrange('waitlist', 0, -1);
  }

  // POST waitlist/ handler for joining the waitlist.
  #doJoinWaitlist = async (user) => {
    await this.uw.redis.rpush('waitlist', user.id);

    const waitlist = await this.getUserIDs();

    this.uw.publish('waitlist:join', {
      userID: user.id,
      waitlist,
    });

    return waitlist;
  }

  // POST waitlist/ handler for adding a (different) user to the waitlist.
  #doAddToWaitlist = async (user, { moderator, waitlist, position }) => {
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

  // used both for joining the waitlist, and for
  // adding someone else to the waitlist.
  // TODO maybe split this up and let http-api handle the difference
  async addUser(userID, { moderator } = {}) {
    const { users } = this.uw;

    const user = await users.getUser(userID);
    if (!user) throw new NotFoundError('User not found.');

    const canForceJoin = await user.can('waitlist.join.locked');
    if (!canForceJoin && await this.isLocked()) {
      throw new PermissionError('The waitlist is locked. Only staff can join.', {
        requiredRole: 'waitlist.join.locked',
      });
    }

    let waitlist = await this.getUserIDs();
    if (isInWaitlist(waitlist, user.id)) {
      throw new PermissionError('You are already in the waitlist.');
    }
    if (await this.#isCurrentDJ(user.id)) {
      throw new PermissionError('You are already currently playing.');
    }
    if (!(await this.#hasValidPlaylist(user))) {
      throw new Error('You don\'t have anything to play. Please add some songs to your '
        + 'playlist and try again.');
    }

    if (!moderator || user.id === moderator.id) {
      waitlist = await this.#doJoinWaitlist(user);
    } else {
      if (!(await moderator.can('waitlist.add'))) {
        throw new PermissionError('You cannot add someone else to the waitlist.', {
          requiredRole: 'waitlist.add',
        });
      }
      waitlist = await this.#doAddToWaitlist(user, {
        moderator,
        waitlist,
        position: waitlist.length,
      });
    }

    if (await this.#isBoothEmpty()) {
      await this.uw.advance();
    }
  }

  async moveUser(userID, position, { moderator } = {}) {
    const { users } = this.uw;

    const user = await users.getUser(userID.toLowerCase());
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    let waitlist = await this.getUserIDs();

    if (!isInWaitlist(waitlist, user.id)) {
      throw new PermissionError('That user is not in the waitlist.');
    }
    if (await this.#isCurrentDJ(user.id)) {
      throw new PermissionError('That user is currently playing.');
    }
    if (!(await this.#hasValidPlaylist(user.id))) {
      throw new Error('That user does not have anything to play.');
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

  async removeUser(userID, { moderator } = {}) {
    const { users } = this.uw;
    const user = await users.getUser(userID);

    const isRemoving = moderator && user.id !== moderator.id;
    if (isRemoving && !(await moderator.can('waitlist.remove'))) {
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

  #lockWaitlist = async (lock, moderator) => {
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

  lock({ moderator }) {
    return this.#lockWaitlist(true, moderator);
  }

  unlock({ moderator }) {
    return this.#lockWaitlist(false, moderator);
  }
}

export default function waitlistPlugin() {
  return (uw) => {
    uw.waitlist = new Waitlist(uw); // eslint-disable-line no-param-reassign
  };
}
