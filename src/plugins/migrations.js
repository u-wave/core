'use strict';

const path = require('path');
const RedLock = require('redlock');
const { Umzug } = require('umzug');
const debug = require('debug')('uwave:migrate');

function log(record) {
  debug(record.event, record.name || record.path || record);
}

/**
 * Custom MongoDBStorage based on Mongoose and with timestamps.
 */
const mongooseStorage = {
  async logMigration({ name, context: uw }) {
    const { Migration } = uw.models;

    await Migration.create({
      migrationName: name,
    });
  },

  async unlogMigration({ name, context: uw }) {
    const { Migration } = uw.models;

    await Migration.deleteOne({
      migrationName: name,
    });
  },

  async executed({ context: uw }) {
    const { Migration } = uw.models;

    const documents = await Migration.find({})
      .select({ migrationName: 1 })
      .lean();
    return documents.map((doc) => doc.migrationName);
  },
};

/**
 * @typedef {import('umzug').InputMigrations<import('../Uwave')>} MigrateOptions
 */
/**
 * @typedef {(opts: MigrateOptions) => Promise<void>} Migrate
 */

/**
 * @param {import('../Uwave')} uw
 */
async function migrationsPlugin(uw) {
  const redLock = new RedLock([uw.redis]);

  async function migrate(migrations) {
    const migrator = new Umzug({
      migrations,
      context: uw,
      storage: mongooseStorage,
      logger: {
        // Only `info` is used right now. When Umzug actually implements the warn/error
        // levels we could pass in different logging functions.
        debug: log,
        info: log,
        warn: log,
        error: log,
      },
    });

    const lock = await redLock.lock('migrate', 10000);
    try {
      await migrator.up();
    } finally {
      await lock.unlock();
    }
  }
  uw.migrate = migrate;

  await uw.migrate({
    glob: ['*.js', { cwd: path.join(__dirname, '../migrations') }],
  });
}

module.exports = migrationsPlugin;
