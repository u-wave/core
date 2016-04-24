import EventEmitter from 'events';
import mongoose, { Connection as MongooseConnection } from 'mongoose';
import Promise from 'bluebird';
import Redis from 'ioredis';
import debug from 'debug';
import values from 'object-values';
import isPlainObject from 'lodash.isplainobject';

import Source from './Source';
import youTubeSource from './sources/youtube';
import soundCloudSource from './sources/soundcloud';

import models from './models';
import booth from './plugins/booth';
import chat from './plugins/chat';

mongoose.Promise = Promise;

type UwaveOptions = {
  mongoose: ?string|Object,
  redis: ?string|Object|Redis
};

export default class UWaveServer extends EventEmitter {
  _sources = {};

  /**
  * Registers middleware on a route
  *
  * @constructor
  * @param {Object} options
  */
  constructor(options: UwaveOptions = {}) {
    super();
    this.parseOptions(options);

    // Will be removed in the future.
    this.source('youtube', youTubeSource, { key: options.keys.youtube });
    this.source('soundcloud', soundCloudSource, { key: options.keys.soundcloud });

    this.log = debug('uwave:core');
    this.mongoLog = debug('uwave:core:mongo');
    this.redisLog = debug('uwave:core:redis');

    this.attachRedisEvents();
    this.attachMongooseEvents();

    this.use(models());
    this.use(booth());
    this.use(chat());

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
    if (arguments.length === 1) {
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
    this.redis.on('error', e => {
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
    this.mongo.on('error', e => {
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
  stop() {
    this.emit('stop');

    this.log('stopping üWave...');

    this.redis.save();
    this.redis.end();
    this.redis.removeAllListeners();
    this.redis = null;

    this.mongo.close(() => {
      this.mongo.removeAllListeners();
      this.mongo = null;
      this.mongoLog('connection closed');
      this.emit('stopped');
    });
  }
}
