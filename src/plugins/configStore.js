import EventEmitter from 'events';
import Ajv from 'ajv';
import ValidationError from '../errors/ValidationError';

const KEY_NAME = 'uw_config';

class ConfigStore {
  constructor(redis) {
    this.redis = redis;
    this.emitter = new EventEmitter();
    this.on = this.emitter.on.bind(this);
    this.off = this.emitter.removeListener.bind(this);
    this.emit = this.emitter.emit.bind(this);

    this.ajv = new Ajv();
    this.registry = Object.create(null);
  }

  #save = json => this.redis.set(KEY_NAME, JSON.stringify(json));

  #load = async () => JSON.parse(await this.redis.get(KEY_NAME));

  register(key, schema) {
    this.registry[key] = this.ajv.compile(schema);
  }

  async get(key) {
    const all = await this.#load();
    if (!all) return undefined;

    return all[key];
  }

  async set(key, value, { user } = {}) {
    const validate = this.registry[key];
    if (validate) {
      if (!validate(value)) {
        throw new ValidationError(validate.errors, this.ajv);
      }
    }
    const all = await this.#load();

    await this.#save({
      ...all,
      [key]: value,
    });

    this.emit(key, value, user);
  }

  getAllConfig() {
    return this.#load();
  }

  getSchema() {
    const properties = {};
    Object.entries(this.registry).forEach(([key, validate]) => {
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
    uw.config = new ConfigStore(uw.redis);
    uw.config.on('set', (key, value, user) => {
      uw.publish('configStore:update', {
        key,
        user: user ? user.id : null,
      });
    });
  };
}
