'use strict';

const mongoose = require('mongoose');
const EventEmitter = require('events');
const Ajv = require('ajv/dist/2019').default;
const formats = require('ajv-formats').default;
const ValidationError = require('../errors/ValidationError');

const { Schema } = mongoose;

/**
 * @typedef {import('../models/User').User} User
 */

const configSchema = new Schema({
  _id: { type: String },
}, {
  collection: 'config_store',
  strict: false,
  toJSON: { versionKey: false },
});

/**
 * Extensible configuration store.
 *
 * The config store contains named groups of settings. Each setting group is
 * stored in its own MongoDB Document. Groups have associated JSON Schemas to
 * check that the configuration is correct.
 */
class ConfigStore {
  #ajv;

  #emitter = new EventEmitter();

  #registry = new Map();

  /**
   * @param {import('mongoose').Connection} mongo
   */
  constructor(mongo) {
    this.ConfigModel = mongo.model('ConfigStore', configSchema);
    this.#ajv = new Ajv({
      useDefaults: true,
      // Allow unknown keywords (`uw:xyz`)
      strict: false,
      strictTypes: true,
    });
    formats(this.#ajv);
    /* eslint-disable global-require */
    this.#ajv.addMetaSchema(require('ajv/dist/refs/json-schema-draft-07.json'));
    this.#ajv.addSchema(require('../schemas/definitions.json'));
    /* eslint-enable global-require */

    this.on = this.#emitter.on.bind(this);
    this.off = this.#emitter.removeListener.bind(this);
    this.emit = this.#emitter.emit.bind(this);
  }

  /**
   * @param {string} key
   * @param {object} values
   * @private
   */
  async save(key, values) {
    await this.ConfigModel.findByIdAndUpdate(
      key,
      { _id: key, ...values },
      { upsert: true },
    );
  }

  /**
   * @param {string} key
   * @returns {Promise<object>}
   * @private
   */
  async load(key) {
    const model = await this.ConfigModel.findById(key);
    if (!model) return null;

    const doc = model.toJSON();
    delete doc._id;
    return doc;
  }

  /**
   * Add a config group.
   *
   * @param {string} key - The name of the config group.
   * @param {import('ajv').SchemaObject} schema - The JSON schema that the settings must
   *     follow.
   * @public
   */
  register(key, schema) {
    this.#registry.set(key, this.#ajv.compile(schema));
  }

  /**
   * Get the current settings for a config group.
   *
   * @param {string} key
   * @returns {Promise<undefined | object>} - `undefined` if the config group named `key` does not
   *     exist. An object containing current settings otherwise.
   * @public
   */
  async get(key) {
    const validate = this.#registry.get(key);
    if (!validate) return undefined;

    const config = (await this.load(key)) || {};
    // Allowed to fail--just fills in defaults
    validate(config);

    return config;
  }

  /**
   * Update settings for a config group. Optionally specify the user who is updating the settings.
   *
   * Rejects if the settings do not follow the schema for the config group.
   *
   * @param {string} key
   * @param {object} settings
   * @param {{ user?: User }} [options]
   * @public
   */
  async set(key, settings, { user } = {}) {
    const validate = this.#registry.get(key);
    if (validate) {
      if (!validate(settings)) {
        throw new ValidationError(validate.errors, this.#ajv);
      }
    }

    await this.save(key, settings);

    this.emit('set', key, settings, user);
  }

  /**
   * Get *all* settings.
   *
   * @returns {Promise<{ [key: string]: object }>}
   */
  async getAllConfig() {
    const all = await this.ConfigModel.find();
    const object = Object.create(null);
    for (const [key, validate] of this.#registry.entries()) {
      const model = all.find((m) => m._id === key);
      object[key] = model ? model.toJSON() : {};
      delete object[key]._id;
      validate(object[key]);
    }
    return object;
  }

  /**
   * @returns {import('ajv').SchemaObject}
   */
  getSchema() {
    const properties = Object.create(null);
    const required = [];
    for (const [key, validate] of this.#registry.entries()) {
      properties[key] = validate.schema;
      required.push(key);
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }
}

/**
 * @param {import('../Uwave')} uw
 */
async function configStorePlugin(uw) {
  uw.config = new ConfigStore(uw.mongo);
  uw.config.on('set', (key, value, user) => {
    uw.publish('configStore:update', {
      key,
      user: user ? user.id : null,
    });
  });
}

module.exports = configStorePlugin;
module.exports.ConfigStore = ConfigStore;
