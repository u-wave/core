'use strict';

const { sql } = require('kysely');

/**
 * @param {import('umzug').MigrationParams<import('../Uwave').default>} params
 */
async function up({ context: uw }) {
  const { db } = uw;

  await db.schema.createTable('socket_auth_tokens')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id'))
    .addColumn('session_id', 'text', (col) => col.notNull()) // TODO: Can I add `.references('sessions.id')`?
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`(strftime('%FT%TZ', 'now'))`))
    .execute();
}

/**
 * @param {import('umzug').MigrationParams<import('../Uwave').default>} params
 */
async function down({ context: uw }) {
  const { db } = uw;

  await db.schema.dropTable('socket_auth_tokens').execute();
}

module.exports = { up, down };
