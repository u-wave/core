'use strict';

const bcrypt = require('bcryptjs');
const createDebug = require('debug');
const escapeStringRegExp = require('escape-string-regexp');
const Page = require('../Page');
const { UserNotFoundError } = require('../errors');
const PasswordError = require('../errors/PasswordError');

const debug = createDebug('uwave:users');

function encryptPassword(password) {
  return bcrypt.hash(password, 10);
}

function getDefaultAvatar(user) {
  return `https://sigil.u-wave.net/${user.id}`;
}

class UsersRepository {
  constructor(uw) {
    this.uw = uw;
  }

  async getUsers(filter = null, page = {}) {
    const User = this.uw.model('User');

    if (filter && (typeof filter.offset === 'number' || typeof filter.limit === 'number')) {
      page = filter; // eslint-disable-line no-param-reassign
      filter = null; // eslint-disable-line no-param-reassign
    }

    debug('getUsers', filter, page);

    const {
      offset = 0,
      limit = 50,
    } = page;

    const query = User.find()
      .skip(offset)
      .limit(limit);
    let queryFilter = null;

    if (filter) {
      if (typeof filter !== 'string') throw new TypeError('User filter must be a string');
      queryFilter = {
        username: new RegExp(escapeStringRegExp(filter)),
      };
      query.where(queryFilter);
    }

    const totalPromise = User.estimatedDocumentCount();

    const [
      users,
      filtered,
      total,
    ] = await Promise.all([
      query,
      queryFilter ? User.find().where(queryFilter).countDocuments() : totalPromise,
      totalPromise,
    ]);

    return new Page(users, {
      pageSize: limit,
      filtered,
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

  login({ type, ...params }) {
    if (type === 'local') {
      return this.localLogin(params);
    }
    return this.socialLogin(type, params);
  }

  async localLogin({ email, password }) {
    const Authentication = this.uw.model('Authentication');

    const auth = await Authentication.findOne({
      email: email.toLowerCase(),
    }).populate('user').exec();
    if (!auth) {
      throw new UserNotFoundError({ email });
    }

    const correct = await bcrypt.compare(password, auth.hash);
    if (!correct) {
      throw new PasswordError('That password is incorrect.');
    }

    return auth.user;
  }

  async socialLogin(type, { profile }) {
    const user = {
      type,
      id: profile.id,
      username: profile.displayName,
      avatar: profile.photos.length > 0 ? profile.photos[0].value : null,
    };
    return this.uw.users.findOrCreateSocialUser(user);
  }

  async findOrCreateSocialUser({
    type,
    id,
    username,
    avatar,
  }) {
    const User = this.uw.model('User');
    const Authentication = this.uw.model('Authentication');

    debug('find or create social', type, id);

    let auth = await Authentication.findOne({ type, id });
    if (auth) {
      await auth.populate('user').execPopulate();

      if (avatar && auth.avatar !== avatar) {
        auth.avatar = avatar;
        await auth.save();
      }
    } else {
      const user = new User({
        username: username ? username.replace(/\s/g, '') : `${type}.${id}`,
        roles: ['user'],
        pendingActivation: type,
      });
      await user.validate();

      auth = new Authentication({
        type,
        user,
        id,
        avatar,
        // HACK, providing a fake email so we can use `unique: true` on emails
        email: `${id}@${type}.sociallogin`,
      });

      try {
        await Promise.all([
          user.save(),
          auth.save(),
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
    username, email, password,
  }) {
    const User = this.uw.model('User');
    const Authentication = this.uw.model('Authentication');

    debug('create user', username, email.toLowerCase());

    const hash = await encryptPassword(password);

    const user = new User({
      username,
      roles: ['user'],
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
      // Two-stage saving to let mongodb decide the user ID before we generate an avatar URL.
      user.avatar = getDefaultAvatar(user);
      await user.save();
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

  async updatePassword(id, password) {
    const Authentication = this.uw.model('Authentication');

    const user = await this.getUser(id);
    if (!user) throw new UserNotFoundError({ id });

    const hash = await encryptPassword(password);

    const auth = await Authentication.findOneAndUpdate({
      // TODO re enable once a migrations thing is set up so that all existing
      // records can be updated to add this.
      // type: 'local',
      user: user._id,
    }, { hash });

    if (!auth) {
      throw new UserNotFoundError({ id: user.id });
    }
  }

  async updateUser(id, update = {}, opts = {}) {
    const user = await this.getUser(id);
    if (!user) throw new UserNotFoundError({ id });

    debug('update user', user.id, user.username, update);

    const moderator = opts && opts.moderator && await this.getUser(opts.moderator);

    const old = {};
    Object.keys(update).forEach((key) => {
      old[key] = user[key];
    });
    Object.assign(user, update);

    await user.save();

    // Take updated keys from the Model again,
    // as it may apply things like Unicode normalization on the values.
    Object.keys(update).forEach((key) => {
      update[key] = user[key];
    });

    this.uw.publish('user:update', {
      userID: user.id,
      moderatorID: moderator ? moderator.id : null,
      old,
      new: update,
    });

    return user;
  }
}

async function usersPlugin(uw) {
  uw.users = new UsersRepository(uw);
}

module.exports = usersPlugin;
module.exports.UsersRepository = UsersRepository;
