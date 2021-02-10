'use strict';

const path = require('path');
const RedLock = require('redlock');
const { Umzug, MongoDBStorage } = require('umzug');
const debug = require('debug')('uwave:migrate');

function log(record) {
  debug(record.event, record.name || record.path || record);
}

async function migrationsPlugin(uw) {
  const redLock = new RedLock([uw.redis]);

  async function migrate(migrations) {
    const migrator = new Umzug({
      migrations,
      context: uw,
      storage: new MongoDBStorage({
        collection: uw.mongo.db.collection('migrations'),
      }),
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
