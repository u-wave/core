'use strict';

const { sql } = require('kysely');

/**
 * @param {import('umzug').MigrationParams<import('../Uwave').default>} params
 */
async function up({ context: uw }) {
  const { db } = uw;

  await db.schema.createTable('password_resets')
    .addColumn('user_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('token', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`(strftime('%FT%TZ', 'now'))`))
    .addUniqueConstraint('password_reset_token', ['token'])
    .execute();

  // Intentionally not populating it, unlikely to use any tokens
  // with our current user numbers :)
}

/**
 * @param {import('umzug').MigrationParams<import('../Uwave').default>} params
 */
async function down({ context: uw }) {
  const { db } = uw;

  await db.schema.dropTable('password_resets').execute();
}

module.exports = { up, down };
