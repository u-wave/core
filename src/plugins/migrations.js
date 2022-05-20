'use strict';

const path = require('path');
const RedLock = require('redlock').default;
const { Umzug } = require('umzug');

/**
 * @typedef {import('../Uwave')} Uwave
 */

/**
 * Custom MongoDBStorage based on Mongoose and with timestamps.
 */
const mongooseStorage = {
  /**
   * @param {import('umzug').MigrationParams<Uwave>} params
   */
  async logMigration({ name, context: uw }) {
    const { Migration } = uw.models;

    await Migration.create({
      migrationName: name,
    });
  },

  /**
   * @param {import('umzug').MigrationParams<Uwave>} params
   */
  async unlogMigration({ name, context: uw }) {
    const { Migration } = uw.models;

    await Migration.deleteOne({
      migrationName: name,
    });
  },

  /**
   * @param {{ context: Uwave }} params
   */
  async executed({ context: uw }) {
    const { Migration } = uw.models;

    /** @type {{ migrationName: string }[]} */
    const documents = await Migration.find({})
      .select({ migrationName: 1 })
      .lean();
    return documents.map((doc) => doc.migrationName);
  },
};

/**
 * @typedef {import('umzug').InputMigrations<import('../Uwave')>} MigrateOptions
 * @typedef {(opts: MigrateOptions) => Promise<void>} Migrate
 */

/**
 * @param {import('../Uwave')} uw
 */
async function migrationsPlugin(uw) {
  const redLock = new RedLock([uw.redis]);

  /** @type {Migrate} */
  async function migrate(migrations) {
    const migrator = new Umzug({
      migrations,
      context: uw,
      storage: mongooseStorage,
      logger: uw.logger.child({ name: 'migrations' }),
    });

    await redLock.using(['migrate'], 10000, async () => {
      await migrator.up();
    });
  }
  uw.migrate = migrate;

  await uw.migrate({
    glob: ['*.js', { cwd: path.join(__dirname, '../migrations') }],
  });
}

module.exports = migrationsPlugin;
