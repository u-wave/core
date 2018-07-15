const mongoose = require('mongoose');
const RedLock = require('redlock');
const debug = require('debug')('uwave:migrate');

const { Schema } = mongoose;

const schema = new Schema({
  _id: { type: String },
}, {
  collection: 'migrations',
  timestamps: true,
});

class Migrations {
  constructor(uw) {
    this.uw = uw;
    this.lock = new RedLock(uw.redis);

    this.uw.mongo.model('Migration', schema);
  }

  get Migration() {
    return this.uw.mongo.model('Migration');
  }

  async load() {
    const migrations = await this.Migration.find();

    this.complete = new Set(migrations.map(m => m.id));
  }

  async sync(name, migration) {
    const lock = await this.lock.lock('migrate', 10000);

    if (!this.complete) await this.load();
    if (this.complete.has(name)) return;

    await migration(this.uw);

    await this.Migration.create({ _id: name });
    this.complete.add(name);
    this.uw.publish('migrate', { name });

    await lock.unlock();
  }
}

async function migrationsPlugin(uw) {
  uw.migrate = new Migrations(uw); // eslint-disable-line no-param-reassign
}

module.exports = migrationsPlugin;
