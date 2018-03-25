import mongoose from 'mongoose';
import secureToken from 'secure-token';
import ms from 'ms';
import NotFoundError from '../errors/NotFoundError';

const { Schema } = mongoose;

type SessionToken = Buffer;

function hash(token) {
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
  async createSession(credentials): SessionToken {
    const { users } = this.uw;
    const { Session } = this;

    const user = await users.login(credentials);

    const token = secureToken.create();
    const session = await Session.create({
      token: hash(token),
      user,
    });

    return token;
  }

  /**
   * Destroy a session.
   */
  async destroySession(token: SessionToken) {
    const { redis } = this.uw;

    const session = await this.getSession(token);

    if (await this.isActive(token)) {
      const hex = hash(token).toString('hex');
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
  async getSession(token: SessionToken) {
    return this.Session.findOne({
      token: hash(token),
    });
  }

  async getUser(token: SessionToken) {
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

    if (await this.isActive(token)) {
      return;
    }

    const session = await this.getSession(token);
    if (!session) {
      throw new NotFoundError('Session expired or does not exist.');
    }

    const hex = hash(token).toString('hex');
    await redis.multi()
      .sadd('sessions:active', hex)
      .incr(`sessions:${hex}`)
      .exec();
    await session.save(); // set `updatedAt`

    this.uw.publish('session:attach', {
      userID: `${session.user}`,
    });
  }

  /**
   * Detach from a session, marking it inactive.
   */
  async detachSession(token: SessionToken) {
    const { redis } = this.uw;

    if (await this.isActive(token)) {
      const hex = hash(token).toString('hex');
      const left = await redis.decr(`sessions:${hex}`);
      if (left === 0) {
        await redis.srem('sessions:active', hex);

        const session = await this.getSession(token);
        this.uw.publish('session:detach', {
          userID: `${session.user}`,
        });
      }
    }
  }

  async refreshSession(token: SessionToken) {
    const { redis } = this.uw;
    const session = await this.getSession(token);
    await session.save(); // set `updatedAt`.
  }

  async isActive(token: SessionToken) {
    const { redis } = this.uw;

    return redis.sismember('sessions:active', hash(token).toString('hex'));
  }

  async exists(token: SessionToken) {
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
  }
}

export default function sessions() {
  return (uw) => {
    uw.sessions = new Sessions(uw);
  };
}
