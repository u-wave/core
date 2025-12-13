import { Store } from 'express-session';
import { callbackify } from 'node:util';
import { fromJson, json, jsonb } from './sqlite.js';
import { addHours, addMilliseconds } from 'date-fns';

export default class SqliteSessionStore extends Store {
  #db;

  /**
   * @param {import('kysely').Kysely<import('../schema.js').Database>} db
   */
  constructor(db) {
    super();
    this.#db = db;
  }

  /**
   * @param {import('express-session').SessionData} session
   */
  #sessionExpiration(session) {
    const { maxAge } = session.cookie;
    if (maxAge != null) {
      return addMilliseconds(new Date(), maxAge);
    }
    return addHours(new Date(), 1);
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
        .select((eb) => json(eb.ref('data')).as('data'))
        .executeTakeFirst();

      if (row != null) {
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
}
