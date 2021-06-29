'use strict';

const bcrypt = require('bcryptjs');
const debug = require('debug')('uwave:users');
const escapeStringRegExp = require('escape-string-regexp');
const Page = require('../Page');
const { IncorrectPasswordError, UserNotFoundError } = require('../errors');

/**
 * @typedef {import('../models').User} User
 */
/**
 * @template T
 * @typedef {import('../types').ToDocument<T>} ToDocument
 */

/**
 * @param {string} password
 */
function encryptPassword(password) {
  return bcrypt.hash(password, 10);
}

/**
 * @param {User} user
 */
function getDefaultAvatar(user) {
  return `https://sigil.u-wave.net/${user.id}`;
}

class UsersRepository {
  /**
   * @param {import('../Uwave')} uw
   */
  constructor(uw) {
    this.uw = uw;
  }

  /**
   * @param {string} [filter]
   * @param {{ offset?: number, limit?: number }} [pagination]
   */
  async getUsers(filter, pagination = {}) {
    const { User } = this.uw.models;

    const {
      offset = 0,
      limit = 50,
    } = pagination;

    const query = User.find()
      .skip(offset)
      .limit(limit);
    let queryFilter = null;

    if (filter) {
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

  /**
   * @param {import('mongodb').ObjectID|string|User} id
   * @returns {Promise<User>}
   */
  getUser(id) {
    const { User } = this.uw.models;
    if (id instanceof User) {
      return Promise.resolve(id);
    }
    return User.findById(id);
  }

  /**
   * @typedef {object} LocalLoginOptions
   * @prop {string} email
   * @prop {string} password
   *
   * @typedef {object} SocialLoginOptions
   * @prop {import('passport').Profile} profile
   *
   * @typedef {LocalLoginOptions & { type: 'local' }} DiscriminatedLocalLoginOptions
   * @typedef {SocialLoginOptions & { type: string }} DiscriminatedSocialLoginOptions
   *
   * @param {DiscriminatedLocalLoginOptions | DiscriminatedSocialLoginOptions} options
   * @returns {Promise<User>}
   */
  login({ type, ...params }) {
    if (type === 'local') {
      // @ts-ignore
      return this.localLogin(params);
    }
    // @ts-ignore
    return this.socialLogin(type, params);
  }

  /**
   * @param {LocalLoginOptions} options
   * @returns {Promise<User>}
   */
  async localLogin({ email, password }) {
    const { Authentication } = this.uw.models;

    /**
     * @type {import('../models').Authentication & { user: User }}
     */
    const auth = await Authentication.findOne({
      email: email.toLowerCase(),
    }).populate('user').exec();
    if (!auth || !auth.hash) {
      throw new UserNotFoundError({ email });
    }

    const correct = await bcrypt.compare(password, auth.hash);
    if (!correct) {
      throw new IncorrectPasswordError();
    }

    return auth.user;
  }

  /**
   * @param {string} type
   * @param {SocialLoginOptions} options
   * @returns {Promise<User>}
   */
  async socialLogin(type, { profile }) {
    const user = {
      type,
      id: profile.id,
      username: profile.displayName,
      avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : undefined,
    };
    return this.uw.users.findOrCreateSocialUser(user);
  }

  /**
   * @typedef {object} FindOrCreateSocialUserOptions
   * @prop {string} type
   * @prop {string} id
   * @prop {string} username
   * @prop {string} [avatar]
   *
   * @param {FindOrCreateSocialUserOptions} options
   * @returns {Promise<User>}
   */
  async findOrCreateSocialUser({
    type,
    id,
    username,
    avatar,
  }) {
    const { User, Authentication } = this.uw.models;

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
        user: user.id,
        auth: { type, id },
      });
    }

    return auth.user;
  }

  /**
   * @param {{ username: string, email: string, password: string }} props
   * @returns {Promise<User>}
   */
  async createUser({
    username, email, password,
  }) {
    const { User, Authentication } = this.uw.models;

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
      user: user.id,
      auth: { type: 'local', email: email.toLowerCase() },
    });

    return user;
  }

  /**
   * @param {import('mongodb').ObjectID} id
   * @param {string} password
   */
  async updatePassword(id, password) {
    const { Authentication } = this.uw.models;

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

  /**
   * @param {import('mongodb').ObjectID|string} id
   * @param {Record<string, string>} update
   * @param {{ moderator?: User }} [options]
   */
  async updateUser(id, update = {}, options = {}) {
    const user = await this.getUser(id);
    if (!user) throw new UserNotFoundError({ id });

    debug('update user', user.id, user.username, update);

    const moderator = options && options.moderator;

    /** @type {Record<string, string>} */
    const old = {};
    Object.keys(update).forEach((key) => {
      old[key] = user[key];
    });
    Object.assign(user, update);

    await user.save();

    // Take updated keys from the Model again,
    // as it may apply things like Unicode normalization on the values.
    Object.keys(update).forEach((key) => {
      // @ts-ignore Infeasible to statically check properties here
      // Hopefully the caller took care
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

/**
 * @param {import('../Uwave')} uw
 */
async function usersPlugin(uw) {
  uw.users = new UsersRepository(uw);
}

module.exports = usersPlugin;
module.exports.UsersRepository = UsersRepository;
