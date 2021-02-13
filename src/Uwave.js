'use strict';

const EventEmitter = require('events');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const debug = require('debug');
const { isPlainObject } = require('lodash');
const { promisify } = require('util');
const avvio = require('avvio');

const HttpApi = require('./HttpApi');
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

mongoose.Promise = Promise;
const MongooseConnection = mongoose.Connection;

const kSources = Symbol('Media sources');

const DEFAULT_MONGO_URL = 'mongodb://localhost:27017/uwave';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

class UwaveServer extends EventEmitter {
  /**
  * @constructor
  * @param {Object} options
  */
  constructor(options = {}) {
    super();

    avvio(this);

    /**
     * @type {Map<string, Source>}
     */
    this[kSources] = new Map();

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

    this.onClose(() => Promise.all([
      this.redis.quit(),
      this.mongo.close(),
    ]));

    this.use(models);
    this.use(migrations);
    this.use(configStore);

    this.use(passport, {
      secret: this.options.secret,
    });

    // Initial API setup
    this.use(HttpApi.plugin, {
      secret: this.options.secret,
      mailTransport: this.options.mailTransport,
      recaptcha: this.options.recaptcha,
      createPasswordResetEmail: this.options.createPasswordResetEmail,
      onError: this.options.onError,
    });
    this.use(SocketServer.plugin, {
      secret: this.options.secret,
    });

    if (this.options.useDefaultPlugins) {
      this.use(acl);
      this.use(chat);
      this.use(motd);
      this.use(playlists);
      this.use(users);
      this.use(bans);
      this.use(history);
      this.use(waitlist);
      this.use(booth);
    }

    this.use(HttpApi.errorHandling);
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
    } else if (options.mongo instanceof MongooseConnection) {
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

  model(name) {
    return this.mongo.model(name);
  }

  /**
   * An array of registered sources.
   */
  get sources() {
    return [...this[kSources].values()];
  }

  /**
   * Get or register a source plugin.
   * If the first parameter is a string, returns an existing source plugin.
   * Else, adds a source plugin and returns its wrapped source plugin.
   *
   * @param sourcePlugin {string|Function|Object} Source name or definition.
   *     When a string: Source type name.
   *     Used to signal where a given media item originated from.
   *     When a function or object: Source plugin or plugin factory.
   * @param opts {Object} Options to pass to the source plugin. Only used if
   *     a source plugin factory was passed to `sourcePlugin`.
   */
  source(sourcePlugin, opts = {}) {
    if (arguments.length === 1 && typeof sourcePlugin === 'string') { // eslint-disable-line prefer-rest-params
      return this[kSources].get(sourcePlugin);
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

    this[kSources].set(sourceType, newSource);

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
   */
  publish(command, data) {
    this.redis.publish('uwave', JSON.stringify({
      command, data,
    }));
    return this;
  }

  async listen() {
    await this.ready();

    const listen = promisify(this.server.listen);
    await listen.call(this.server, this.options.port);
  }
}

module.exports = UwaveServer;
