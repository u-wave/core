'use strict';

const EventEmitter = require('events');
const { promisify } = require('util');
const mongoose = require('mongoose');
const Redis = require('ioredis').default;
const avvio = require('avvio');
const { pino } = require('pino');

const httpApi = require('./HttpApi');
const SocketServer = require('./SocketServer');
const { Source } = require('./Source');
const { i18n } = require('./locale');

const models = require('./models');
const configStore = require('./plugins/configStore');
const assets = require('./plugins/assets');
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

const baseSchema = require('./schemas/base.json');

const DEFAULT_MONGO_URL = 'mongodb://localhost:27017/uwave';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

/**
 * @typedef {import('./Source').SourcePlugin} SourcePlugin
 */

/**
 * @typedef {UwaveServer & avvio.Server<UwaveServer>} Boot
 * @typedef {Pick<
 *   import('ioredis').RedisOptions,
 *   'port' | 'host' | 'family' | 'path' | 'db' | 'password' | 'username' | 'tls'
 * >} RedisOptions
 * @typedef {{
 *   port?: number,
 *   mongo?: string,
 *   redis?: string | RedisOptions,
 *   logger?: import('pino').LoggerOptions,
 * } & httpApi.HttpApiOptions} Options
 */

class UwaveServer extends EventEmitter {
  /** @type {import('ioredis').default} */
  redis;

  /** @type {import('http').Server} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  server;

  /** @type {import('express').Application} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  express;

  /** @type {import('./models').Models} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  models;

  /** @type {import('./plugins/acl').Acl} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  acl;

  /** @type {import('./plugins/bans').Bans} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  bans;

  /** @type {import('./plugins/booth').Booth} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  booth;

  /** @type {import('./plugins/chat').Chat} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  chat;

  /** @type {import('./plugins/configStore').ConfigStore} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  config;

  /** @type {import('./plugins/assets').Assets} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  assets;

  /** @type {import('./plugins/history').HistoryRepository} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  history;

  /** @type {import('./plugins/migrations').Migrate} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  migrate;

  /** @type {import('./plugins/motd').MOTD} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  motd;

  /** @type {import('./plugins/passport').Passport} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  passport;

  /** @type {import('./plugins/playlists').PlaylistsRepository} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  playlists;

  /** @type {import('./plugins/users').UsersRepository} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  users;

  /** @type {import('./plugins/waitlist').Waitlist} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  waitlist;

  /** @type {import('./HttpApi').HttpApi} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  httpApi;

  /** @type {import('./SocketServer')} */
  // @ts-expect-error TS2564 Definitely assigned in a plugin
  socketServer;

  /**
   * @type {Map<string, Source>}
   */
  #sources = new Map();

  /** @type {import('pino').Logger} */
  #mongoLogger;

  /**
   * @param {Options} options
   */
  constructor(options) {
    super();

    const boot = avvio(this);

    this.logger = pino({
      ...options.logger,
      redact: ['req.headers.cookie', 'res.headers["set-cookie"]'],
    });
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

    this.#mongoLogger = this.logger.child({ ns: 'uwave:mongo' });

    this.configureRedis();
    this.configureMongoose();

    boot.onClose(() => Promise.all([
      this.redis.quit(),
      this.mongo.close(),
    ]));

    // Wait for the connections to be set up.
    boot.use(async () => {
      this.#mongoLogger.debug('waiting for mongodb...');
      await this.mongo.asPromise();
    });

    boot.use(models);
    boot.use(migrations);

    boot.use(configStore);
    boot.use(async (uw) => {
      uw.config.register(baseSchema['uw:key'], baseSchema);
    });

    boot.use(assets);
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
    boot.use(SocketServer.plugin);

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
   * @typedef {((uw: UwaveServer, opts: object) => SourcePlugin)} SourcePluginFactory
   * @typedef {SourcePlugin | SourcePluginFactory} ToSourcePlugin
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

    const sourceDefinition = typeof sourceFactory === 'function'
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

  /**
   * @private
   */
  configureRedis() {
    const log = this.logger.child({ ns: 'uwave:redis' });

    this.redis.on('error', (error) => {
      log.error(error);
      this.emit('redisError', error);
    });
    this.redis.on('reconnecting', () => {
      log.info('trying to reconnect...');
    });

    this.redis.on('end', () => {
      log.info('disconnected');
      this.emit('redisDisconnect');
    });

    this.redis.on('connect', () => {
      log.info('connected');
      this.emit('redisConnect');
    });
  }

  /**
   * @private
   */
  configureMongoose() {
    this.mongo.on('error', (error) => {
      this.#mongoLogger.error(error);
      this.emit('mongoError', error);
    });

    this.mongo.on('reconnected', () => {
      this.#mongoLogger.info('reconnected');
      this.emit('mongoReconnect');
    });

    this.mongo.on('disconnected', () => {
      this.#mongoLogger.info('disconnected');
      this.emit('mongoDisconnect');
    });

    this.mongo.on('connected', () => {
      this.#mongoLogger.info('connected');
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
    // @ts-expect-error TS2322
    const boot = this; // eslint-disable-line @typescript-eslint/no-this-alias
    await boot.ready();

    /** @type {(this: import('net').Server, port?: number) => Promise<void>} */
    const listen = promisify(this.server.listen);
    await listen.call(this.server, this.options.port);
  }
}

module.exports = UwaveServer;
