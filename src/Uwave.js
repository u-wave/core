import EventEmitter from 'events';
import mongoose, { Connection as MongooseConnection } from 'mongoose';
import Promise from 'bluebird';
import Redis from 'ioredis';
import debug from 'debug';
import values from 'object-values';
import isPlainObject from 'lodash.isplainobject';

import Source from './Source';

import models from './models';
import booth from './plugins/booth';
import chat from './plugins/chat';
import motd from './plugins/motd';
import playlists from './plugins/playlists';
import users from './plugins/users';

mongoose.Promise = Promise;

type UwaveOptions = {
  useDefaultPlugins: ?bool,
  mongo: ?string|Object,
  redis: ?string|Object|Redis
};

export default class UWaveServer extends EventEmitter {
  _sources = {};

  options = {
    useDefaultPlugins: true
  };

  /**
  * Registers middleware on a route
  *
  * @constructor
  * @param {Object} options
  */
  constructor(options: UwaveOptions = {}) {
    super();
    this.parseOptions(options);

    this.log = debug('uwave:core');
    this.mongoLog = debug('uwave:core:mongo');
    this.redisLog = debug('uwave:core:redis');

    this.attachRedisEvents();
    this.attachMongooseEvents();

    if (this.options.useDefaultPlugins) {
      this.use(models());
      this.use(booth());
      this.use(chat());
      this.use(motd());
      this.use(playlists());
      this.use(users());
    }

    process.nextTick(() => {
      this.emit('started');
    });
  }

  /**
   * Deprecated in favour of `.options`.
   */
  get config() {
    return this.options;
  }

  parseOptions(options: UwaveOptions) {
    if (Array.isArray(options.mongo)) {
      this.mongo = mongoose.createConnection(...options.mongo);
    } else if (typeof options.mongo === 'string' || isPlainObject(options.mongo)) {
      this.mongo = mongoose.createConnection(options.mongo);
    } else if (options.mongo instanceof MongooseConnection) {
      this.mongo = options.mongo;
    } else {
      this.mongo = mongoose.createConnection('mongodb://localhost:27017/uwave');
    }

    if (typeof options.redis === 'string') {
      this.redis = new Redis(options.redis, { lazyConnect: true });
    } else if (typeof options.redis === 'object') {
      this.redis = new Redis(options.redis.port, options.redis.host, {
        ...options.redis.options,
        lazyConnect: true
      });
    } else if (options.redis instanceof Redis) {
      this.redis = options.redis;
    } else {
      this.redis = new Redis({ lazyConnect: true });
    }

    Object.assign(this.options, options);
  }

  use(plugin) {
    plugin(this);
    return this;
  }

  model(name) {
    return this.mongo.model(name);
  }

  advance(opts = {}) {
    this.log('advance', opts);
    return this.booth.advance(opts);
  }

  sendChat(user, message) {
    return this.chat.send(user, message);
  }

  deleteChat(filter = {}, opts = {}) {
    return this.chat.delete(filter, opts);
  }

  getMotd() {
    return this.motd.get();
  }

  setMotd(text) {
    return this.motd.set(text);
  }

  // TODO add filter
  getUsers(page = {}) {
    return this.users.getUsers(page);
  }

  getUser(id) {
    return this.users.getUser(id);
  }

  createUser(opts) {
    return this.users.createUser(opts);
  }

  updateUser(user, update, opts = {}) {
    return this.users.updateUser(user, update, opts);
  }

  /**
   * An array of registered sources.
   */
  get sources() {
    return values(this._sources);
  }

  /**
   * Find or register a source plugin.
   * If only the first parameter is passed, returns an existing source plugin.
   * If more parameters are passed, adds a source plugin and returns its wrapped
   * source plugin.
   *
   * @param sourceType {string} Source type name. Used to signal where a given
   *     media item originated from.
   * @param sourcePlugin {Function|Object} Source plugin or plugin factory.
   * @param opts {Object} Options to pass to the source plugin. Only used if
   *     a source plugin factory was passed to `sourcePlugin`.
   */
  source(sourceType, sourcePlugin, opts = {}) {
    if (arguments.length === 1) { // eslint-disable-line prefer-rest-params
      return this._sources[sourceType];
    }

    const sourceFactory = sourcePlugin.default || sourcePlugin;
    const type = typeof sourceFactory;
    if (type !== 'function' && type !== 'object') {
      throw new TypeError(`Source plugin should be a function, got ${type}`);
    }

    const newSource = new Source(
      this,
      sourceType,
      type === 'function'
        ? sourceFactory(this, opts)
        : sourceFactory
    );

    this._sources[sourceType] = newSource;

    return newSource;
  }

  attachRedisEvents() {
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

  attachMongooseEvents() {
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
   * Set up database connections.
   *
   * @deprecated Noop.
   */
  connect() {
    return this;
  }

  /**
   * Old name for connect().
   *
   * @deprecated Noop.
   */
  start() {
    return this;
  }

  /**
   * Create a Redis subscription to the üWave channel.
   *
   * @return {IORedis} Redis instance, subscribed to the üWave channel.
   */
  subscription() {
    const sub = this.redis.duplicate();
    sub.subscribe('uwave');
    this.on('stop', () => {
      sub.end();
    });
    return sub;
  }

  /**
   * Publish an event to the üWave channel.
   */
  publish(command, data) {
    this.redis.publish('uwave', JSON.stringify({
      command, data
    }));
    return this;
  }

  /**
  * Stop this üWave instance.
  */
  async stop() {
    this.emit('stop');

    this.log('stopping üWave...');

    await Promise.all([
      this.redis.end(),
      this.mongo.close()
    ]);

    this.emit('stopped');
  }
}
