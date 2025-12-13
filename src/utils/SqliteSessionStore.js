import { Store } from 'express-session';
import { Kysely } from 'kysely';
import { callbackify } from 'node:util';
import { fromJson, json, jsonb } from './sqlite.js';

export default class SqliteSessionStore extends Store {
  #db

  /**
   * @param {Kysely<import('../schema.js').Database>} db
   */
  constructor(db) {
    super();
    this.#db = db;
  }

  /**
   * @param {string} sid
   * @param {(err: unknown, session?: import('express-session').SessionData | null) => void} callback
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
    callbackify(async () => {
      await this.#db.replaceInto('sessions')
        .values({
          id: sid,
          data: jsonb(/** @type {import('type-fest').JsonObject} */ (
            /** @type {unknown} */ (session)
          )),
        })
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
}
