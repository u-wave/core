import { fromJson, json, jsonb } from './utils/sqlite.js';

export default class KeyValue {
  #db;

  /** @param {import('./schema.js').Kysely} db */
  constructor(db) {
    this.#db = db;
  }

  /** @param {string} key */
  async get(key, db = this.#db) {
    const row = await db.selectFrom('keyval')
      .select((eb) => json(eb.ref('value')).as('value'))
      .where('key', '=', key)
      .executeTakeFirst();
    if (row == null) {
      return undefined;
    }
    return fromJson(row.value);
  }

  /**
   * @param {string} key
   * @param {import('type-fest').JsonValue} value
   */
  async set(key, value, db = this.#db) {
    await db.insertInto('keyval')
      .values({ key, value: jsonb(value) })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value: jsonb(value) }))
      .execute();
  }

  /**
   * Delete a key, returning its previous value if any.
   *
   * @param {string} key
   * @returns {Promise<import('type-fest').JsonValue | undefined>}
   */
  async delete(key, db = this.#db) {
    const existing = await db.deleteFrom('keyval')
      .where('key', '=', key)
      .returning((eb) => json(eb.ref('value')).as('value'))
      .executeTakeFirst();

    if (existing == null) {
      return undefined;
    }

    return fromJson(existing.value);
  }
}
