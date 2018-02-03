import * as bcrypt from 'bcryptjs';
import createDebug from 'debug';
import Page from '../Page';

const debug = createDebug('uwave:users');

function encryptPassword(password) {
  return bcrypt.hash(password, 10);
}

function getDefaultAvatar(user) {
  return `https://sigil.u-wave.net/${user.id}`;
}

export class UsersRepository {
  constructor(uw) {
    this.uw = uw;
  }

  async getUsers(page = {}) {
    const User = this.uw.model('User');

    const {
      offset = 0,
      limit = 50,
    } = page;

    const users = await User.find()
      .skip(offset)
      .limit(limit);

    const total = await User.count();

    return new Page(users, {
      pageSize: limit,
      filtered: total,
      total,
      current: { offset, limit },
      next: offset + limit <= total ? { offset: offset + limit, limit } : null,
      previous: offset > 0
        ? { offset: Math.max(offset - limit, 0), limit }
        : null,
    });
  }

  getUser(id) {
    const User = this.uw.model('User');
    if (id instanceof User) {
      return id;
    }
    return User.findById(id);
  }

  async findOrCreateSocialUser({
    type,
    id,
    username,
    avatar,
    role = 0,
  }) {
    const User = this.uw.model('User');
    const Authentication = this.uw.model('Authentication');

    debug('find or create social', type, id);

    let auth = await Authentication.findOne({ type, id });
    if (auth) {
      await auth.populate('user').execPopulate();
    } else {
      const user = new User({
        username: username.replace(/\s/g, ''),
        avatar,
        role,
      });
      await user.validate();

      auth = new Authentication({
        type,
        user,
        id,
        // HACK, providing a fake email so we can use `unique: true` on emails
        email: `${id}@${type}.sociallogin`
      });

      try {
        await Promise.all([
          user.save(),
          auth.save()
        ]);
      } catch (e) {
        if (!auth.isNew) {
          await auth.remove();
        }
        await user.remove();
        throw e;
      }

      this.uw.publish('user:create', {
        user: user.toJSON(),
        auth: { type, id },
      });
    }

    return auth.user;
  }

  async createUser({
    username, email, password, role = 0,
  }) {
    const User = this.uw.model('User');
    const Authentication = this.uw.model('Authentication');

    debug('create user', username, email.toLowerCase(), role);

    const hash = await encryptPassword(password);

    const user = new User({
      username,
      role,
    });
    await user.validate();

    const auth = new Authentication({
      type: 'local',
      user,
      email: email.toLowerCase(),
      hash,
    });

    try {
      await Promise.all([
        user.save(),
        auth.save(),
      ]);
      await user.update({
        avatar: getDefaultAvatar(user),
      });
    } catch (e) {
      if (!auth.isNew) {
        await auth.remove();
      }
      await user.remove();
      throw e;
    }

    this.uw.publish('user:create', {
      user: user.toJSON(),
      auth: { type: 'local', email: email.toLowerCase() },
    });

    return user;
  }

  async updateUser(id, update = {}, opts = {}) {
    const user = await this.getUser(id);
    if (!user) throw new Error('User not found.');

    debug('update user', user.id, user.username, update);

    const moderator = opts && opts.moderator && await this.getUser(opts.moderator);

    const old = {};
    Object.keys(update).forEach((key) => {
      old[key] = user[key];
    });
    Object.assign(user, update);

    await user.save();

    this.uw.publish('user:update', {
      userID: user.id,
      moderatorID: moderator ? moderator.id : null,
      old,
      new: update,
    });

    return user;
  }
}

export default function usersPlugin() {
  return (uw) => {
    uw.users = new UsersRepository(uw);
  };
}
