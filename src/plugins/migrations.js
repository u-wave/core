'use strict';

const path = require('path');
const RedLock = require('redlock');
const { Umzug, MongoDBStorage } = require('umzug');
const debug = require('debug')('uwave:migrate');

async function migrationsPlugin(uw) {
  const redLock = new RedLock([uw.redis]);

  async function migrate(migrations) {
    const migrator = new Umzug({
      migrations,
      context: uw,
      storage: new MongoDBStorage({
        collection: uw.mongo.collection('migrations'),
      }),
      logger: {
        debug: debug.extend('debug'),
        info: debug.extend('info'),
        warn: debug.extend('warn'),
        error: debug.extend('error'),
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
