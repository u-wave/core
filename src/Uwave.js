const EventEmitter = require('events');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const debug = require('debug');
const { isPlainObject } = require('lodash');

const HttpApi = require('./HttpApi');
const SocketServer = require('./SocketServer');
const { Source } = require('./Source');
const { i18n } = require('./locale');

const models = require('./models');
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
const errorHandler = require('./middleware/errorHandler');

mongoose.Promise = Promise;
const MongooseConnection = mongoose.Connection;

const kSources = Symbol('Media sources');

const DEFAULT_MONGO_URL = 'mongodb://localhost:27017/uwave';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

class UwaveServer extends EventEmitter {
  [kSources] = new Map();

  locale = i18n.cloneInstance();

  options = {
    useDefaultPlugins: true,
  };

  /**
  * Registers middleware on a route
  *
  * @constructor
  * @param {Object} options
  */
  constructor(options = {}) {
    super();
    this.#parseOptions(options);

    this.log = debug('uwave:core');
    this.mongoLog = debug('uwave:core:mongo');
    this.redisLog = debug('uwave:core:redis');

    this.#configureRedis();
    this.#configureMongoose();

    this.use(models());
    this.use(passport({
      secret: this.options.secret,
      auth: this.options.auth || {},
    }));

    // TODO possibly auto-add to server
    // TODO possibly create http server here
    this.httpApi = new HttpApi(this, {
      secret: this.options.secret,
    });
    this.socketServer = new SocketServer(this, {
      secret: this.options.secret,
      server: this.options.server,
      port: this.options.port,
    });

    if (this.options.useDefaultPlugins) {
      this.use(booth());
      this.use(chat());
      this.use(motd());
      this.use(playlists());
      this.use(users());
      this.use(bans());
      this.use(history());
      this.use(acl());
      this.use(waitlist());
    }

    this.httpApi.use(errorHandler());

    process.nextTick(() => {
      this.emit('started');
    });
  }

  #parseOptions = (options) => {
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
      this.mongo = mongoose.createConnection(DEFAULT_MONGO_URL, {
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
      });
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
  };

  use(plugin) {
    plugin(this);
    return this;
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

  #configureRedis = () => {
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
  };

  #configureMongoose = () => {
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
  };

  /**
   * Create a Redis subscription to the üWave channel.
   *
   * @return {IORedis} Redis instance, subscribed to the üWave channel.
   */
  subscription() {
    const sub = this.redis.duplicate();
    sub.subscribe('uwave');
    this.on('stop', () => {
      sub.quit();
    });
    return sub;
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

  /**
   * Stop this üWave instance.
   */
  async stop() {
    this.emit('stop');

    this.log('stopping üWave...');

    await this.socketServer.destroy();

    await Promise.all([
      this.redis.quit(),
      this.mongo.close(),
    ]);

    this.emit('stopped');
  }
}

module.exports = UwaveServer;
