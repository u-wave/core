'use strict';

const { sql } = require('kysely');

/**
 * @param {import('umzug').MigrationParams<import('../Uwave').default>} params
 */
async function up({ context: uw }) {
  const { db } = uw;

  await db.schema.createTable('socket_message_queue')
    // This contains a ULID which also encodes the timestamp.
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('target_user_id', 'uuid', (col) => col.references('users.id'))
    .addColumn('command', 'text', (col) => col.notNull())
    .addColumn('data', 'jsonb', (col) => col.notNull().defaultTo(sql`(jsonb('null'))`))
    .execute();
}

/**
 * @param {import('umzug').MigrationParams<import('../Uwave').default>} params
 */
async function down({ context: uw }) {
  const { db } = uw;

  await db.schema.dropTable('socket_message_queue').execute();
}

module.exports = { up, down };
