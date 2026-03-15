import { sql } from 'kysely';
import nodeCrypto from 'node:crypto';
import { promisify } from 'node:util';
import { addMinutes, isAfter } from './utils/date.js';

const randomBytes = promisify(nodeCrypto.randomBytes);

/** @type {import('kysely').RawBuilder<Date>} */
const earliestValidTokenTime = sql`(strftime('%FT%TZ', 'now', '-60 seconds'))`;

class AuthRegistry {
  #db;

  #latestCleanup = new Date();

  /**
   * @param {import('./schema.js').Kysely} db
   */
  constructor(db) {
    this.#db = db;
  }

  async #cleanup() {
    await this.#db.deleteFrom('socketAuthTokens')
      .where('createdAt', '<', earliestValidTokenTime)
      .execute();
  }

  #autoCleanup() {
    const now = new Date();
    const nextCleanup = addMinutes(this.#latestCleanup, 1);
    if (isAfter(now, nextCleanup)) {
      this.#latestCleanup = now;
      this.#cleanup().catch((err) => {
        console.warn(err);
      });
    }
  }

  /**
   * @param {import('./schema.js').User} user
   * @param {string} sessionID
   */
  async createAuthToken(user, sessionID) {
    const token = (await randomBytes(64)).toString('hex');

    await this.#db.insertInto('socketAuthTokens')
      .values({
        id: token,
        userID: user.id,
        sessionID,
      })
      .execute();

    return token;
  }

  /**
   * @param {string} token
   */
  async getTokenUser(token) {
    if (token.length !== 128) {
      throw new Error('Invalid token');
    }

    const result = await this.#db.deleteFrom('socketAuthTokens')
      .where('id', '=', token)
      .where('createdAt', '>=', earliestValidTokenTime)
      .returning(['userID', 'sessionID'])
      .executeTakeFirstOrThrow();

    this.#autoCleanup();

    return result;
  }
}

export default AuthRegistry;
