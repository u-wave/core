import EventEmitter from 'events';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import debug from 'debug';
import { values, isPlainObject } from 'lodash';

import Source from './Source';
import Page from './Page';

import models from './models';
import booth from './plugins/booth';
import chat from './plugins/chat';
import motd from './plugins/motd';
import playlists from './plugins/playlists';
import users from './plugins/users';
import bans from './plugins/bans';
import history from './plugins/history';
import acl from './plugins/acl';
import waitlist from './plugins/waitlist';

mongoose.Promise = Promise;
const MongooseConnection = mongoose.Connection;

const kSources = Symbol('Media sources');

const DEFAULT_MONGO_URL = 'mongodb://localhost:27017/uwave';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

type UwaveOptions = {
  useDefaultPlugins: ?bool,
  mongo: ?string|Object,
  redis: ?string|Object|Redis
};

export default class UWaveServer extends EventEmitter {
  [kSources] = {};

  options = {
    useDefaultPlugins: true,
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

    this.#attachRedisEvents();
    this.#attachMongooseEvents();

    if (this.options.useDefaultPlugins) {
      this.use(models());
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

    process.nextTick(() => {
      this.emit('started');
    });
  }

  parseOptions(options: UwaveOptions) {
    if (typeof options.mongo === 'string' || isPlainObject(options.mongo)) {
      this.mongo = mongoose.createConnection(options.mongo);
    } else if (options.mongo instanceof MongooseConnection) {
      this.mongo = options.mongo;
    } else {
      this.mongo = mongoose.createConnection(DEFAULT_MONGO_URL);
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

  /**
   * An array of registered sources.
   */
  get sources() {
    return values(this[kSources]);
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
      return this[kSources][sourcePlugin];
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

    this[kSources][sourceType] = newSource;

    return newSource;
  }

  #attachRedisEvents = () => {
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

  #attachMongooseEvents = () => {
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
      sub.end();
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

    await Promise.all([
      this.redis.quit(),
      this.mongo.close(),
    ]);

    this.emit('stopped');
  }
}
