const path = require('path');
const { promisify } = require('util');
const mongoose = require('mongoose');
const RedLock = require('redlock');
const migrate = require('migrate');
const debug = require('debug')('uwave:migrate');

const { Schema } = mongoose;

const schema = new Schema({}, {
  collection: 'migrations',
  timestamps: true,
});

class MongoStore {
  constructor(db) {
    this.db = db;
    this.db.model('Migration', schema);
  }

  load(callback) {
    const Migration = this.db.model('Migration');
    Migration.find().sort({ createdAt: -1 }).findOne((err, set) => {
      if (err) {
        callback(err);
      } else if (set) {
        callback(null, set);
      } else {
        callback(null, {});
      }
    });
  }

  save(set, callback) {
    const Migration = this.db.model('Migration');
    Migration.create(set, (err) => {
      callback(err);
    });
  }
}

async function migrationsPlugin(uw) {
  const redLock = new RedLock([uw.redis]);

  const lock = await redLock.lock('migrate', 10000);
  try {
    const store = new MongoStore(uw.mongo);
    const load = promisify(migrate.load);

    const set = await load({
      stateStore: store,
      migrationsDirectory: path.join(__dirname, '../migrations'),
    });

    set.migrations.forEach((migration) => {
      if (migration.up) {
        migration.up = migration.up.bind(migration, uw);
      }
      if (migration.down) {
        migration.down = migration.down.bind(migration, uw);
      }
    });

    await promisify(set.up)();
  } finally {
    await lock.unlock();
  }
}

module.exports = migrationsPlugin;
