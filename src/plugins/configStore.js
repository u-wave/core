import mongoose from 'mongoose';
import EventEmitter from 'events';
import Ajv from 'ajv';
import ValidationError from '../errors/ValidationError';

const { Schema } = mongoose;
const KEY_NAME = 'uw_config';

const configSchema = new Schema({
  _id: { type: String },
}, {
  collection: 'config_store',
  strict: false,
  toJSON: { versionKey: false },
});

class ConfigStore {
  #ConfigModel = null;
  #ajv = new Ajv();
  #emitter = new EventEmitter();
  #registry = Object.create(null);

  constructor(mongo) {
    this.#ConfigModel = mongo.model('ConfigStore', configSchema);

    this.on = this.#emitter.on.bind(this);
    this.off = this.#emitter.removeListener.bind(this);
    this.emit = this.#emitter.emit.bind(this);
  }

  #save = (key, values) => this.#ConfigModel.findByIdAndUpdate(
    key,
    { _id: key, ...values },
    { upsert: true },
  );

  #load = async (key) => {
    const model = await this.#ConfigModel.findById(key);
    if (!model) return null;

    const doc = model.toJSON();
    delete doc._id;
    return doc;
  };

  register(key, schema) {
    this.#registry[key] = this.#ajv.compile(schema);
  }

  async get(key) {
    const config = await this.#load(key);
    if (!config) return undefined;

    return config;
  }

  async set(key, value, { user } = {}) {
    const validate = this.#registry[key];
    if (validate) {
      if (!validate(value)) {
        throw new ValidationError(validate.errors, this.#ajv);
      }
    }

    await this.#save(key, value);

    this.emit(key, value, user);
  }

  async getAllConfig() {
    const all = await this.#ConfigModel.find();
    const object = {};
    all.forEach((model) => {
      object[model._id] = model.toJSON();
      delete object[model._id]._id;
    });
    return object;
  }

  getSchema() {
    const properties = {};
    Object.entries(this.#registry).forEach(([key, validate]) => {
      properties[key] = validate.schema;
    });

    return {
      type: 'object',
      properties,
    };
  }
}

export default function configStorePlugin() {
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
