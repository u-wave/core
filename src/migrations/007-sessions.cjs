'use strict';

const { sql } = require('kysely');

/**
 * @param {import('umzug').MigrationParams<import('../Uwave').default>} params
 */
async function up({ context: uw }) {
  const { db } = uw;

  await db.schema.createTable('sessions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('data', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`(strftime('%FT%TZ', 'now'))`))
    .addColumn('expires_at', 'timestamp', (col) => col.notNull().defaultTo(sql`(strftime('%FT%TZ', 'now', '+1 hour'))`))
    .execute();
}

/**
 * @param {import('umzug').MigrationParams<import('../Uwave').default>} params
 */
async function down({ context: uw }) {
  const { db } = uw;

  await db.schema.dropTable('sessions').execute();
}

module.exports = { up, down };
