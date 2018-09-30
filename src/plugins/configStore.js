import mongoose from 'mongoose';
import EventEmitter from 'events';
import Ajv from 'ajv';
import ValidationError from '../errors/ValidationError';

type ConfigValues = {
  [string]: any,
};

type JSONSchema = {
  type: string,
};

const { Schema, Connection } = mongoose;

const configSchema = new Schema({
  _id: { type: String },
}, {
  collection: 'config_store',
  strict: false,
  toJSON: { versionKey: false },
});

class ConfigStore {
  #ConfigModel = null;

  #ajv = new Ajv({ useDefaults: true });

  #emitter = new EventEmitter();

  #registry = Object.create(null);

  constructor(mongo: Connection) {
    this.#ConfigModel = mongo.model('ConfigStore', configSchema);

    this.on = this.#emitter.on.bind(this);
    this.off = this.#emitter.removeListener.bind(this);
    this.emit = this.#emitter.emit.bind(this);
  }

  #save = async (key: string, values: ConfigValues): Promise<void> => {
    await this.#ConfigModel.findByIdAndUpdate(
      key,
      { _id: key, ...values },
      { upsert: true },
    );
  };

  #load = async (key: string): ConfigValues => {
    const model = await this.#ConfigModel.findById(key);
    if (!model) return null;

    const doc = model.toJSON();
    delete doc._id;
    return doc;
  };

  register(key: string, schema: JSONSchema): void {
    this.#registry[key] = this.#ajv.compile(schema);
  }

  async get(key: string): ?ConfigValues {
    const validate = this.#registry[key];
    if (!validate) return undefined;

    const config = (await this.#load(key)) || {};
    validate(config);

    return config;
  }

  async set(key: string, value: ConfigValues, { user } = {}): Promise<void> {
    const validate = this.#registry[key];
    if (validate) {
      if (!validate(value)) {
        throw new ValidationError(validate.errors, this.#ajv);
      }
    }

    await this.#save(key, value);

    this.emit(key, value, user);
  }

  async getAllConfig(): Promise<{ [string]: ConfigValues }> {
    const all = await this.#ConfigModel.find();
    const keys = Object.keys(this.#registry);
    const object = {};
    keys.forEach((key) => {
      const validate = this.#registry[key];

      const model = all.find((m) => m._id === key);
      object[key] = model ? model.toJSON() : {};
      delete object[key]._id;
      validate(object[key]);
    });
    return object;
  }

  getSchema(): JSONSchema {
    const properties = {};
    const required = [];
    Object.entries(this.#registry).forEach(([key, validate]) => {
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
