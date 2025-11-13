'use strict';

/**
 * @param {import('umzug').MigrationParams<import('../Uwave').default>} params
 */
async function up({ context: uw }) {
  const { db } = uw;

  await db.schema.createTable('keyval')
    .addColumn('key', 'text', (col) => col.primaryKey())
    .addColumn('value', 'jsonb')
    .execute();

  // Intentionally not populating it, no big deal to lose waitlist / current dj state
  // with our current user numbers :)
}

/**
 * @param {import('umzug').MigrationParams<import('../Uwave').default>} params
 */
async function down({ context: uw }) {
  const { db } = uw;

  await db.schema.dropTable('keyval').execute();
}

module.exports = { up, down };
