'use strict';

const has = require('has');
const EventEmitter = require('events');
const { promisify } = require('util');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const debug = require('debug');
const avvio = require('avvio');

const httpApi = require('./HttpApi');
const SocketServer = require('./SocketServer');
const { LegacySourceWrapper } = require('./source/Source');
const pluginifySource = require('./source/plugin');
const { i18n } = require('./locale');

const models = require('./models');
const configStore = require('./plugins/configStore');
const booth = require('./plugins/booth');
const chat = require('./plugins/chat');
const motd = require('./plugins/motd');
const playlists = require('./plugins/playlists');
const users = require('./plugins/users');
const bans = require('./plugins/bans');
const history = require('./plugins/history');
const acl = require('./plugins/acl');
const waitlist = require('./plugins/waitlist');
const passport = require('./plugins/passport');
const migrations = require('./plugins/migrations');

const DEFAULT_MONGO_URL = 'mongodb://localhost:27017/uwave';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

/** @typedef {import('./source/types').StaticSourcePlugin} StaticSourcePlugin */
/** @typedef {import('./source/Source').SourceWrapper} SourceWrapper */

/**
 * @typedef {UwaveServer & avvio.Server<UwaveServer>} Boot
 * @typedef {Pick<
 *   Redis.RedisOptions,
 *   'port' | 'host' | 'family' | 'path' | 'db' | 'password' | 'username' | 'tls'
 * >} RedisOptions
 * @typedef {{
 *   port?: number,
 *   mongo?: string,
 *   redis?: string | RedisOptions,
 * } & httpApi.HttpApiOptions} Options
 */

class UwaveServer extends EventEmitter {
  /** @type {Redis.Redis} */
  redis;

  /** @type {import('http').Server} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  server;

  /** @type {import('express').Application} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  express;

  /** @type {import('./models').Models} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  models;

  /** @type {import('./plugins/acl').Acl} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  acl;

  /** @type {import('./plugins/bans').Bans} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  bans;

  /** @type {import('./plugins/booth').Booth} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  booth;

  /** @type {import('./plugins/chat').Chat} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  chat;

  /** @type {import('./plugins/configStore').ConfigStore} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  config;

  /** @type {import('./plugins/history').HistoryRepository} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  history;

  /** @type {import('./plugins/migrations').Migrate} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  migrate;

  /** @type {import('./plugins/motd').MOTD} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  motd;

  /** @type {import('./plugins/passport').Passport} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  passport;

  /** @type {import('./plugins/playlists').PlaylistsRepository} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  playlists;

  /** @type {import('./plugins/users').UsersRepository} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  users;

  /** @type {import('./plugins/waitlist').Waitlist} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  waitlist;

  /** @type {import('./HttpApi').HttpApi} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  httpApi;

  /** @type {import('./SocketServer')} */
  // @ts-ignore TS2564 Definitely assigned in a plugin
  socketServer;

  /**
   * @type {Map<string, SourceWrapper>}
   */
  #sources = new Map();

  /**
   * @param {Options} options
   */
  constructor(options) {
    super();

    const boot = avvio(this);

    this.locale = i18n.cloneInstance();

    this.options = {
      mongo: DEFAULT_MONGO_URL,
      redis: DEFAULT_REDIS_URL,
      ...options,
    };

    this.mongo = mongoose.createConnection(this.options.mongo);

    if (typeof options.redis === 'string') {
      this.redis = new Redis(options.redis, { lazyConnect: true });
    } else {
      this.redis = new Redis({ ...options.redis, lazyConnect: true });
    }

    this.log = debug('uwave:core');
    this.mongoLog = debug('uwave:core:mongo');
    this.redisLog = debug('uwave:core:redis');

    this.configureRedis();
    this.configureMongoose();

    boot.onClose(() => Promise.all([
      this.redis.quit(),
      this.mongo.close(),
    ]));

    // Wait for the connections to be set up.
    boot.use(async () => {
      this.mongoLog('waiting for mongodb...');
      await this.mongo.asPromise();
    });

    boot.use(models);
    boot.use(migrations);
    boot.use(configStore);

    boot.use(passport, {
      secret: this.options.secret,
    });

    // Initial API setup
    boot.use(httpApi, {
      secret: this.options.secret,
      helmet: this.options.helmet,
      mailTransport: this.options.mailTransport,
      recaptcha: this.options.recaptcha,
      createPasswordResetEmail: this.options.createPasswordResetEmail,
      onError: this.options.onError,
    });
    boot.use(SocketServer.plugin, {
      secret: this.options.secret,
    });

    boot.use(acl);
    boot.use(chat);
    boot.use(motd);
    boot.use(playlists);
    boot.use(users);
    boot.use(bans);
    boot.use(history);
    boot.use(waitlist);
    boot.use(booth);

    boot.use(httpApi.errorHandling);
  }

  /**
   * Register a source plugin.
   *
   * @template TOptions
   * @template {import('./source/types').HotSwappableSourcePlugin<
   *     TOptions, import('type-fest').JsonValue>} TPlugin
   * @param {TPlugin} sourcePlugin
   * @param {TOptions} [opts]
   */
  async useSource(sourcePlugin, opts) {
    /** @type {import('avvio').Avvio<this>} */
    // @ts-ignore
    const boot = this;

    boot.use(pluginifySource, {
      source: sourcePlugin,
      baseOptions: opts,
    });
  }

  /**
   * An array of registered sources.
   *
   * @type {SourceWrapper[]}
   */
  get sources() {
    return [...this.#sources.values()];
  }

  /**
   * Get or register a source plugin.
   * If the first parameter is a string, returns an existing source plugin.
   * Else, adds a source plugin and returns its wrapped source plugin.
   *
   * @typedef {(uw: UwaveServer, opts: object) => StaticSourcePlugin} SourcePluginFactory
   * @typedef {StaticSourcePlugin | SourcePluginFactory} ToSourcePlugin
   *
   * @param {string | Omit<ToSourcePlugin, 'default'> | { default: ToSourcePlugin }} sourcePlugin
   *     Source name or definition.
   *     When a string: Source type name.
   *     Used to signal where a given media item originated from.
   *     When a function or object: Source plugin or plugin factory.
   * @param {object} opts Options to pass to the source plugin. Only used if
   *     a source plugin factory was passed to `sourcePlugin`.
   */
  source(sourcePlugin, opts = {}) {
    if (typeof sourcePlugin === 'string') { // eslint-disable-line prefer-rest-params
      return this.#sources.get(sourcePlugin);
    }

    const sourceFactory = 'default' in sourcePlugin && sourcePlugin.default ? sourcePlugin.default : sourcePlugin;
    if (typeof sourceFactory !== 'function' && typeof sourceFactory !== 'object') {
      throw new TypeError(`Source plugin should be a function, got ${typeof sourceFactory}`);
    }

    if (typeof sourceFactory === 'function'
        && has(sourceFactory, 'api')
        && typeof sourceFactory.api === 'number'
        && sourceFactory.api >= 3) {
      throw new TypeError('uw.source() only supports old-style source plugins.');
    }

    const sourceDefinition = typeof sourceFactory === 'function'
      ? sourceFactory(this, opts)
      : sourceFactory;
    const sourceType = sourceDefinition.name;
    if (typeof sourceType !== 'string') {
      throw new TypeError('Source plugin does not specify a name. It may be incompatible with this version of üWave.');
    }
    const newSource = new LegacySourceWrapper(this, sourceType, sourceDefinition);

    this.insertSourceInternal(sourceType, newSource);

    return newSource;
  }

  /**
   * Adds a fully wrapped source plugin. Not for external use.
   *
   * @param {string} sourceType
   * @param {SourceWrapper} source
   */
  insertSourceInternal(sourceType, source) {
    this.#sources.set(sourceType, source);
  }

  /**
   * Removes a source plugin. Not for external use.
   *
   * Only source plugins using Media Source API 3 or higher can be removed.
   *
   * @param {string} sourceType
   */
  removeSourceInternal(sourceType) {
    const source = this.#sources.get(sourceType);
    if (this.#sources.delete(sourceType)) {
      return source;
    }
    return null;
  }

  configureRedis() {
    this.redis.on('error', (e) => {
      this.emit('redisError', e);
    });
    this.redis.on('reconnecting', () => this.redisLog('trying to reconnect...'));

    this.redis.on('end', () => {
      this.redisLog('disconnected');
      this.emit('redisDisconnect');
    });

    this.redis.on('connect', () => {
      this.redisLog('connected');
      this.emit('redisConnect');
    });
  }

  /**
   * @private
   */
  configureMongoose() {
    this.mongo.on('error', (e) => {
      this.mongoLog(e);
      this.emit('mongoError', e);
    });

    this.mongo.on('reconnected', () => {
      this.mongoLog('reconnected');
      this.emit('mongoReconnect');
    });

    this.mongo.on('disconnected', () => {
      this.mongoLog('disconnected');
      this.emit('mongoDisconnect');
    });

    this.mongo.on('connected', () => {
      this.mongoLog('connected');
      this.emit('mongoConnect');
    });
  }

  /**
   * Publish an event to the üWave channel.
   *
   * @template {keyof import('./redisMessages').ServerActionParameters} CommandName
   * @param {CommandName} command
   * @param {import('./redisMessages').ServerActionParameters[CommandName]} data
   */
  publish(command, data) {
    this.redis.publish('uwave', JSON.stringify({
      command, data,
    }));
    return this;
  }

  async listen() {
    /** @type {import('avvio').Avvio<this>} */
    // @ts-ignore
    const boot = this;
    await boot.ready();

    /** @type {(this: import('net').Server, port?: number) => Promise<void>} */
    const listen = promisify(this.server.listen);
    await listen.call(this.server, this.options.port);
  }
}

module.exports = UwaveServer;
