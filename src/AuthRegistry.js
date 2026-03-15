import { sql } from 'kysely';
import nodeCrypto from 'node:crypto';
import { promisify } from 'node:util';

const randomBytes = promisify(nodeCrypto.randomBytes);

class AuthRegistry {
  #db;

  /**
   * @param {import('./schema.js').Kysely} db
   */
  constructor(db) {
    this.#db = db;
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
      .where(
        'createdAt',
        '>',
        /** @type {import('kysely').RawBuilder<Date>} */
        (sql`(strftime('%FT%TZ', 'now', '-60 seconds'))`),
      )
      .returning(['userID', 'sessionID'])
      .executeTakeFirstOrThrow();

    return result;
  }
}

export default AuthRegistry;
