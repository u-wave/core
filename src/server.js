import bodyParser from 'body-parser';
import EventEmitter from 'events';
import mongoose from 'mongoose';
import readline from 'readline';
import Promise from 'bluebird';
import express from 'express';
import Redis from 'ioredis';
import debug from 'debug';
import http from 'http';

import models from './models';

mongoose.Promise = Promise;

export default class UWaveServer extends EventEmitter {
  /**
  * Registers middleware on a route
  *
  * @constructor
  * @param {Object} config - for further information, see src/config/server.json.example
  */
  constructor(config = {}) {
    super();
    this.config = config;

    this.app = express();
    this.server = http.createServer(this.app);

    this.mongo = mongoose.createConnection();
    if (typeof config.redis === 'string') {
      this.redis = new Redis(config.redis, { lazyConnect: true });
    } else if (typeof config.redis === 'object') {
      this.redis = new Redis(config.redis.port, config.redis.host, {
        ...config.redis.options,
        lazyConnect: true
      });
    } else if (config.redis instanceof Redis) {
      this.redis = config.redis;
    } else {
      this.redis = new Redis({ lazyConnect: true });
    }

    this.log = debug('uwave:server');
    this.mongoLog = debug('uwave:mongo');
    this.redisLog = debug('uwave:redis');

    this.use(models());

    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use((req, res, next) => {
      /* eslint-disable no-param-reassign */
      req.uwave = this;
      /* eslint-enable no-param-reassign */
      next();
    });

    /* ======== SIGINT ======== */
    // workaround to properly stop the server on termination.
    if (process.platform === 'win32') {
      readline.createInterface({
        input: process.stdin,
        output: process.stdout
      }).on('SIGINT', () => process.emit('SIGINT'));
    }

    process.on('SIGINT', () => { this.stop(); });
  }

  use(plugin) {
    plugin(this);
    return this;
  }

  model(name) {
    return this.mongo.model(name);
  }

  _createRedisConnection() {
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

    return this.redis.connect();
  }

  _createMongoConnection() {
    const promise = this.mongo.open(
      `mongodb://${this.config.mongo.host}:${this.config.mongo.port}/uwave`,
      this.config.mongo.options
    );

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

    return promise;
  }

  /**
   * Set up database connections.
   */
  async connect() {
    this.log('starting server...');

    await Promise.all([
      this._createRedisConnection(),
      this._createMongoConnection()
    ]);

    this.emit('started', this);
    this.log('server started');

    return this;
  }

  /**
   * Old name for connect().
   *
   * @deprecated
   */
  start() {
    return this.connect();
  }

  /**
   * Create a Redis subscription to the üWave channel.
   *
   * @return {IORedis} Redis instance, subscribed to the üWave channel.
   */
  subscription() {
    const sub = this.redis.duplicate();
    sub.subscribe('uwave');
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
  * Stops the server
  */
  stop() {
    this.log('stopping server...');
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
