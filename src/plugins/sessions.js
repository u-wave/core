import mongoose from 'mongoose';
import secureToken from 'secure-token';
import ms from 'ms';
import NotFoundError from '../errors/NotFoundError';

const { Schema } = mongoose;

type SessionToken = Buffer;
type HashedSessionToken = Buffer;

function hash(token: SessionToken): HashedSessionToken {
  return secureToken.hash(token, 'session');
}

/**
 * Manage user sessions.
 *
 * A session has a unique ID and a token. The ID is allowed to be shown to
 * moderators and such. The token is private and used for authentication.
 *
 * When a user logs in, a session is created with a random token. This token is
 * stored (hashed) in mongodb. Every so often, old sessions are cleaned up.
 *
 * When a user connects, they attach to an existing session with their token.
 * This marks the session as active, i.e., currently in use. When a user
 * disconnects, they detach from the session, marking it inactive.
 * A user can have multiple sessions and be attached to the same session
 * multiple times (multi device, and opening multiple tabs on a single device).
 * The last bit is up for revision, it doesn't make much sense to attach to the
 * same session more than once, the clients won't stay in sync anyway.
 */
class Sessions {
  constructor(uw) {
    this.uw = uw;

    this.uw.mongo.model('Session', new Schema({
      token: {
        type: Schema.Types.Buffer,
        unique: true,
        required: true,
        select: false, // Don't accidentally leak this.
      },
      user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        required: true,
      },
    }, { timestamps: true }));
  }

  get Session() {
    return this.uw.model('Session');
  }

  /**
   * Sign a user in and create a new session.
   */
  async createSession(credentials): { token: SessionToken, user: any } {
    const { users } = this.uw;
    const { Session } = this;

    const user = await users.login(credentials);

    const token = secureToken.create();
    await Session.create({
      token: hash(token),
      user,
    });

    return { token, user };
  }

  /**
   * Destroy a session.
   */
  async destroySession(token: HashedSessionToken) {
    const { redis } = this.uw;

    const session = await this.getSession(token);

    if (await this.isActive(token)) {
      const hex = token.toString('hex');
      await redis.multi()
        .del(`sessions:${hex}`)
        .srem('sessions:active', hex)
        .exec();

      this.uw.publish('sessions:detach', {
        userID: `${session.user}`,
      });
    }

    await session.remove();
  }

  /**
   * Get the session belonging to a token.
   */
  async getSession(token: HashedSessionToken) {
    return this.Session.findOne({
      token,
    });
  }

  /**
   * Securely the user for the given session.
   */
  async getSecureUser(token: SessionToken) {
    return this.getUser(hash(token));
  }

  /**
   * Get the user for the given session, by their semi-not-secret hashed session token.
   */
  async getUser(token: HashedSessionToken) {
    const { users } = this.uw;

    const session = await this.getSession(token);
    if (!session) throw new NotFoundError('Session not found');

    return users.getUser(session.user);
  }

  /**
   * Attach to a session, marking it active.
   */
  async attachSession(token: SessionToken) {
    const { redis } = this.uw;
    const hashedToken = hash(token);

    if (await this.isActive(hashedToken)) {
      return;
    }

    const session = await this.getSession(hashedToken);
    if (!session) {
      throw new NotFoundError('Session expired or does not exist.');
    }

    const emitJoin = !(await this.isActiveUser(session.user));

    const hex = hashedToken.toString('hex');
    await redis.multi()
      .sadd('sessions:active', hex)
      .incr(`sessions:${hex}`)
      .exec();
    await session.save(); // set `updatedAt`

    this.uw.publish('session:attach', {
      userID: `${session.user}`,
    });
    if (emitJoin) {
      this.uw.publish('user:join', {
        userID: `${session.user}`,
      });
    }
  }

  /**
   * Detach from a session, marking it inactive.
   */
  async detachSession(token: HashedSessionToken) {
    const { redis } = this.uw;

    if (await this.isActive(token)) {
      const session = await this.getSession(token);

      const hex = hash(token).toString('hex');
      const left = await redis.decr(`sessions:${hex}`);
      if (left === 0) {
        await redis.srem('sessions:active', hex);

        this.uw.publish('session:detach', {
          userID: `${session.user}`,
        });
      }

      // If no active sessions are left for this user, emit leave.
      if (!(await this.isActiveUser(session.user))) {
        await this.removeActiveUser(session.user);
      }
    }
  }

  async removeActiveUser(user: any) {
    const { booth } = this.uw;

    await booth.removeUser(user);

    this.uw.publish('user:leave', {
      userID: `${user}`,
    });
  }

  async refreshSession(token: SessionToken) {
    const hashedToken = hash(token);
    const session = await this.getSession(hashedToken);
    await session.save(); // set `updatedAt`.
  }

  async isActive(token: HashedSessionToken) {
    const { redis } = this.uw;

    return redis.sismember('sessions:active', token.toString('hex'));
  }

  async exists(token: HashedSessionToken) {
    const session = await this.getSession(token);

    return !!session;
  }

  async getSessions() {
    const { redis } = this.uw;

    const sessions = await this.Session.find().select('+token');
    const activeTokens = await redis.smembers('sessions:active');

    sessions.forEach((session) => {
      session.active = activeTokens.includes(session.token.toString('hex'));
    });

    return sessions;
  }

  async isActiveUser(userID) {
    const { users, redis } = this.uw;
    const user = await users.getUser(userID);

    const userSessions = await this.Session.find({ user }).select('+token');

    const query = userSessions.reduce(
      (pipe, session) =>
        pipe.sismember('sessions:active', session.token.toString('hex')),
      redis.multi(),
    );

    const results = await query.exec();

    return results.some(result => !!result[1]);
  }

  async getActiveUsers() {
    const { redis } = this.uw;

    const activeTokens = await redis.smembers('sessions:active');
    const sessions = await this.Session.where({
      token: {
        $in: activeTokens.map(hashedToken => Buffer.from(hashedToken, 'hex')),
      },
    }).populate('user');

    return sessions.map(s => s.user);
  }

  async cleanup() {
    const sessions = await this.Session.where({
      updatedAt: { $lt: new Date(Date.now() + ms('31 days')) },
    });

    // TODO implement
    void sessions; // eslint-disable-line
  }
}

export default function sessionsPlugin() {
  return (uw) => {
    uw.sessions = new Sessions(uw);
  };
}
