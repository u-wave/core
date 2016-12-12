import * as bcrypt from 'bcrypt';

const debug = require('debug')('uwave:users');

function encryptPassword(password) {
  return bcrypt.hash(password, 10);
}

export class UsersRepository {
  constructor(uw) {
    this.uw = uw;
  }

  async getUsers(page = {}) {
    const User = this.uw.model('User');

    const {
      offset = 0,
      limit = 50
    } = page;

    const users = await User.find()
      .skip(offset)
      .limit(limit);

    return users;
  }

  getUser(id) {
    const User = this.uw.model('User');
    if (id instanceof User) {
      return id;
    }
    return User.findById(id);
  }

  async createUser({ username, email, password, role = 0 }) {
    const User = this.uw.model('User');
    const LocalAuth = this.uw.model('Authentication');

    debug('create user', username, email, role);

    const hash = await encryptPassword(password);

    const user = new User({
      username,
      role
    });
    await user.validate();

    const auth = new LocalAuth({
      user,
      email,
      hash
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
      auth: { email }
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
      new: update
    });

    return user;
  }
}

export default function usersPlugin() {
  return (uw) => {
    uw.users = new UsersRepository(uw); // eslint-disable-line no-param-reassign
  };
}
