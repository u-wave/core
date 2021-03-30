'use strict';

const EventEmitter = require('events');
const { promisify } = require('util');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const debug = require('debug');
const { isPlainObject } = require('lodash');
const avvio = require('avvio');

const httpApi = require('./HttpApi');
const SocketServer = require('./SocketServer');
const { Source } = require('./Source');
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

/**
 * @template T
 * @param {any} value
 * @returns {T}
 */
function unsafeCast(value) {
  return value;
}

/**
 * @typedef {UwaveServer & import('avvio').Server<UwaveServer>} Boot
 */

class UwaveServer extends EventEmitter {
  /** @type {import('ioredis').Redis} */
  redis;

  /** @type {import('http').Server} */
  server;

  /** @type {import('express').Application} */
  express;

  /** @type {import('./models').Models} */
  models;

  /** @type {import('./plugins/acl').Acl} */
  acl;

  /** @type {import('./plugins/bans').Bans} */
  bans;

  /** @type {import('./plugins/booth').Booth} */
  booth;

  /** @type {import('./plugins/chat').Chat} */
  chat;

  /** @type {import('./plugins/configStore').ConfigStore} */
  config;

  /** @type {import('./plugins/history').HistoryRepository} */
  history;

  /** @type {import('./plugins/migrations').Migrate} */
  migrate;

  /** @type {import('./plugins/motd').MOTD} */
  motd;

  /** @type {import('./plugins/passport').Passport} */
  passport;

  /** @type {import('./plugins/playlists').PlaylistsRepository} */
  playlists;

  /** @type {import('./plugins/users').UsersRepository} */
  users;

  /** @type {import('./plugins/waitlist').Waitlist} */
  waitlist;

  /** @type {import('./HttpApi').HttpApi} */
  httpApi;

  /** @type {import('./SocketServer')} */
  socketServer;

  /**
   * @type {Map<string, Source>}
   */
  #sources = new Map();

  /**
  * @param {object} [options]
  * @param {boolean} [options.useDefaultPlugins]
  */
  constructor(options = {}) {
    super();

    const boot = avvio(this);

    this.locale = i18n.cloneInstance();

    this.options = {
      useDefaultPlugins: true,
    };

    this.parseOptions(options);

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
      await this.mongo;
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
      mailTransport: this.options.mailTransport,
      recaptcha: this.options.recaptcha,
      createPasswordResetEmail: this.options.createPasswordResetEmail,
      onError: this.options.onError,
    });
    boot.use(SocketServer.plugin, {
      secret: this.options.secret,
    });

    if (this.options.useDefaultPlugins) {
      boot.use(acl);
      boot.use(chat);
      boot.use(motd);
      boot.use(playlists);
      boot.use(users);
      boot.use(bans);
      boot.use(history);
      boot.use(waitlist);
      boot.use(booth);
    }

    boot.use(httpApi.errorHandling);
  }

  parseOptions(options) {
    const defaultOptions = {
      useNewUrlParser: true,
      useCreateIndex: true,
      useFindAndModify: false,
      useUnifiedTopology: true,
    };

    if (typeof options.mongo === 'string') {
      this.mongo = mongoose.createConnection(options.mongo, defaultOptions);
    } else if (isPlainObject(options.mongo)) {
      this.mongo = mongoose.createConnection({
        ...defaultOptions,
        ...options.mongo,
      });
    } else if (options.mongo instanceof mongoose.Connection) {
      this.mongo = options.mongo;
    } else {
      this.mongo = mongoose.createConnection(DEFAULT_MONGO_URL, defaultOptions);
    }

    if (typeof options.redis === 'string') {
      this.redis = new Redis(options.redis, { lazyConnect: true });
    } else if (isPlainObject(options.redis)) {
      this.redis = new Redis(options.redis.port, options.redis.host, {
        ...options.redis.options,
        lazyConnect: true,
      });
    } else if (options.redis instanceof Redis) {
      this.redis = options.redis;
    } else {
      this.redis = new Redis(DEFAULT_REDIS_URL, { lazyConnect: true });
    }

    Object.assign(this.options, options);
  }

  /**
   * @param {string} name
   * @deprecated Use `uw.models[modelName]` instead.
   */
  model(name) {
    return this.mongo.model(name);
  }

  /**
   * An array of registered sources.
   *
   * @type {Source[]}
   */
  get sources() {
    return [...this.#sources.values()];
  }

  /**
   * Get or register a source plugin.
   * If the first parameter is a string, returns an existing source plugin.
   * Else, adds a source plugin and returns its wrapped source plugin.
   *
   * @param {string|Function|Object} sourcePlugin Source name or definition.
   *     When a string: Source type name.
   *     Used to signal where a given media item originated from.
   *     When a function or object: Source plugin or plugin factory.
   * @param {object} opts Options to pass to the source plugin. Only used if
   *     a source plugin factory was passed to `sourcePlugin`.
   */
  source(sourcePlugin, opts = {}) {
    if (arguments.length === 1 && typeof sourcePlugin === 'string') { // eslint-disable-line prefer-rest-params
      return this.#sources.get(sourcePlugin);
    }

    const sourceFactory = sourcePlugin.default || sourcePlugin;
    const type = typeof sourceFactory;
    if (type !== 'function' && type !== 'object') {
      throw new TypeError(`Source plugin should be a function, got ${type}`);
    }

    const sourceDefinition = type === 'function'
      ? sourceFactory(this, opts)
      : sourceFactory;
    const sourceType = sourceDefinition.name;
    if (typeof sourceType !== 'string') {
      throw new TypeError('Source plugin does not specify a name. It may be incompatible with this version of üWave.');
    }
    const newSource = new Source(this, sourceType, sourceDefinition);

    this.#sources.set(sourceType, newSource);

    return newSource;
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
    const boot = unsafeCast(this);
    await boot.ready();

    /** @type {(this: import('net').Server, port: number) => Promise<void>} */
    const listen = promisify(this.server.listen);
    await listen.call(this.server, this.options.port);
  }
}

module.exports = UwaveServer;
