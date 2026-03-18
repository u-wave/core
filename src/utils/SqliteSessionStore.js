import { Store } from 'express-session';
import { callbackify } from 'node:util';
import {
  fromJson,
  json,
  jsonb,
  now,
} from './sqlite.js';
import { addHours, addMilliseconds, isBefore } from './date.js';

export default class SqliteSessionStore extends Store {
  #db;

  #logger;

  /**
   * @param {import('kysely').Kysely<import('../schema.js').Database>} db
   * @param {import('pino').Logger} logger
   */
  constructor(db, logger) {
    super();
    this.#db = db;
    this.#logger = logger;
  }

  /**
   * @param {import('express-session').SessionData} session
   */
  #sessionExpiration(session) {
    const maxAge = session.cookie?.maxAge;
    if (maxAge != null) {
      return addMilliseconds(new Date(), maxAge);
    }
    return addHours(new Date(), 1);
  }

  async #cleanup() {
    const result = await this.#db.deleteFrom('sessions')
      .where('expiresAt', '<', now)
      .executeTakeFirst();

    if (result != null) {
      this.#logger.debug({ sessionsDeleted: result.numDeletedRows }, 'cleaned up stale express-sessions');
    }
  }

  /**
   * @param {string} sid
   * @param {(
   *   err: unknown,
   *   session?: import('express-session').SessionData | null,
   * ) => void} callback
   */
  get(sid, callback) {
    callbackify(async () => {
      const row = await this.#db.selectFrom('sessions')
        .where('id', '=', sid)
        .select(['expiresAt', (eb) => json(eb.ref('data')).as('data')])
        .executeTakeFirst();

      if (row != null) {
        if (isBefore(row.expiresAt, new Date())) {
          this.#cleanup().catch((err) => {
            this.#logger.warn({ err }, 'automatic express-session cleanup failed');
          });

          return null;
        }

        return /** @type {import('express-session').SessionData | null} */ (
          /** @type {unknown} */ (fromJson(row.data))
        );
      }

      return null;
    })(callback);
  }

  /**
   * @param {string} sid
   * @param {import('express-session').SessionData} session
   * @param {(err?: unknown) => void} callback
   */
  set(sid, session, callback) {
    const expiresAt = this.#sessionExpiration(session);

    callbackify(async () => {
      await this.#db.replaceInto('sessions')
        .values({
          id: sid,
          data: jsonb(/** @type {import('type-fest').JsonObject} */ (
            /** @type {unknown} */ (session)
          )),
          expiresAt,
        })
        .executeTakeFirstOrThrow();
    })(callback);
  }

  /**
   * @param {string} sid
   * @param {import('express-session').SessionData} session
   * @param {(err?: unknown) => void} callback
   */
  touch(sid, session, callback) {
    const expiresAt = this.#sessionExpiration(session);

    callbackify(async () => {
      await this.#db.updateTable('sessions')
        .where('id', '=', sid)
        .set({ expiresAt })
        .executeTakeFirstOrThrow();
    })(callback);
  }

  /**
   * @param {string} sid
   * @param {(err?: unknown) => void} callback
   */
  destroy(sid, callback) {
    callbackify(async () => {
      await this.#db.deleteFrom('sessions')
        .where('id', '=', sid)
        .executeTakeFirstOrThrow();
    })(callback);
  }

  /**
   * @param {(err: unknown, length?: number) => void} callback
   */
  length(callback) {
    callbackify(async () => {
      const { count } = await this.#db.selectFrom('sessions')
        .select((eb) => eb.fn.countAll().as('count'))
        .executeTakeFirstOrThrow();
      return Number(count);
    })(callback);
  }

  /**
   * @param {(err?: unknown) => void} callback
   */
  clear(callback) {
    callbackify(async () => {
      await this.#db.deleteFrom('sessions').execute();
    })(callback);
  }
}
