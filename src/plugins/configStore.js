const mongoose = require('mongoose');
const EventEmitter = require('events');
const Ajv = require('ajv');
const ValidationError = require('../errors/ValidationError');

const { Schema } = mongoose;

const configSchema = new Schema({
  _id: { type: String },
}, {
  collection: 'config_store',
  strict: false,
  toJSON: { versionKey: false },
});

class ConfigStore {
  constructor(mongo) {
    this.ConfigModel = mongo.model('ConfigStore', configSchema);
    this.ajv = new Ajv({ useDefaults: true });
    this.emitter = new EventEmitter();
    this.registry = Object.create(null);

    this.on = this.emitter.on.bind(this);
    this.off = this.emitter.removeListener.bind(this);
    this.emit = this.emitter.emit.bind(this);
  }

  async save(key, values) {
    await this.ConfigModel.findByIdAndUpdate(
      key,
      { _id: key, ...values },
      { upsert: true },
    );
  }

  async load(key) {
    const model = await this.ConfigModel.findById(key);
    if (!model) return null;

    const doc = model.toJSON();
    delete doc._id;
    return doc;
  }

  register(key, schema) {
    this.registry[key] = this.ajv.compile(schema);
  }

  async get(key) {
    const validate = this.registry[key];
    if (!validate) return undefined;

    const config = (await this.load(key)) || {};
    validate(config);

    return config;
  }

  async set(key, value, { user } = {}) {
    const validate = this.registry[key];
    if (validate) {
      if (!validate(value)) {
        throw new ValidationError(validate.errors, this.ajv);
      }
    }

    await this.save(key, value);

    this.emit(key, value, user);
  }

  async getAllConfig() {
    const all = await this.ConfigModel.find();
    const keys = Object.keys(this.registry);
    const object = {};
    keys.forEach((key) => {
      const validate = this.registry[key];

      const model = all.find((m) => m._id === key);
      object[key] = model ? model.toJSON() : {};
      delete object[key]._id;
      validate(object[key]);
    });
    return object;
  }

  getSchema() {
    const properties = {};
    const required = [];
    Object.entries(this.registry).forEach(([key, validate]) => {
      properties[key] = validate.schema;
      required.push(key);
    });

    return {
      type: 'object',
      properties,
      required,
    };
  }
}

function configStorePlugin() {
  return (uw) => {
    uw.config = new ConfigStore(uw.mongo);
    uw.config.on('set', (key, value, user) => {
      uw.publish('configStore:update', {
        key,
        user: user ? user.id : null,
      });
    });
  };
}

module.exports = configStorePlugin;
