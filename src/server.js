import bodyParser from 'body-parser';
import EventEmitter from 'events';
import mongoose from 'mongoose';
import readline from 'readline';
import bluebird from 'bluebird';
import express from 'express';
import redis from 'ioredis';
import { Server } from 'ws';
import debug from 'debug';
import http from 'http';

mongoose.Promise = bluebird;

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

    this.mongo = null;
    this.redis = null;

    this.log = debug('uwave:server');
    this.mongoLog = debug('uwave:mongo');
    this.redisLog = debug('uwave:redis');

    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use((req, res, next) => {
      req.uwave = {
        'redis': this.redis,
        'mongo': this.mongo,
        'keys': this.config.keys
      };
      next();
    });

    /* ======== SIGINT ======== */
    // workaround to properly stop the server on termination.
    if (process.platform === 'win32') {
      readline.createInterface({
        'input': process.stdin,
        'output': process.stdout
      }).on('SIGINT', () => process.emit('SIGINT'));
    }

    process.on('SIGINT', () => { this.stop(); });
  }

  /**
  * Registers middleware on a route
  *
  * @param {string} path - path the middleware should be registered at
  * @param {function} middleware - the middleware that should be registered
  * @event UWaveServer:registerMiddleware
  * @private
  */
  _registerMiddleware(path, middleware) {
    if (typeof path === 'function') {
      this.app.use(path);
      this.log(`registered middleware ${path.name}`);
    } else if (typeof path === 'string') {
      this.app.use(path, middleware);
      this.log(`registered middleware ${middleware.name} on path '${path}'`);
    } else {
      return this.log('no middleware registered');
    }

    this.emit('registerMiddleware', path, middleware);
  }

  /**
  * Registers api on a route
  *
  * @param {string} path - path the api should be registered at
  * @param {function} router - the api as an express router
  * @event UWaveServer:registerAPI
  * @private
  */
  _registerAPI(path, router) {
    if (typeof path !== 'string') throw new Error('path has to be of type string');
    if (typeof router === 'undefined') throw new Error(`API router for '${path}' was not defined`);

    this.app.use(path, router);
    this.emit('registerAPI', path, router);
    this.log(`registered API ${router.name} on path '${path}'`);
  }

  _createRedisConnection(connected) {
    this.redis = new redis(this.config.redis.port, this.config.redis.host, this.config.redis.options);
    this.redis.on('ready', () => connected(this.redisLog));
    this.redis.on('error', e => this.emit('redisError', e));
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

  _createMongoConnection(connected) {
    this.mongo = mongoose.createConnection(`mongodb://${this.config.mongo.host}:${this.config.mongo.port}/uwave`, this.config.mongo.options);
    this.mongo.once('open', () => connected(this.mongoLog));

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
  }

  /**
  * Registers middleware on a route
  *
  * @param {string} path - path the middleware should be registered at
  * @param {function} middleware - the middleware that should be registered
  * @event UWaveServer:registerMiddleware
  */
  registerMiddleware(path, middleware) {
    // assume that path is an array of middleware functions
    if (!Array.isArray(path)) {
      this._registerMiddleware(path, middleware);
    } else {
      path.forEach(ware => {
        this._registerMiddleware(ware.path, ware.middleware);
      });
    }
  }

  /**
  * Registers api on a route
  *
  * @param {string} path - path the api should be registered at
  * @param {function} router - the api as an express router
  * @event UWaveServer:registerAPI
  */
  registerAPI(path, router) {
    // assume that path is an array of api functions
    if (!Array.isArray(path)) {
      this._registerAPI(path, router);
    } else {
      path.forEach(api => {
        this._registerAPI(api.path, api.router);
      });
    }
  }

  /**
  * get the server config
  **/
  getConfig() {
    return this.config;
  }

  /**
  * get the server instance
  **/
  getServer() {
    return this.server;
  }

  /**
  * gets the express.app instance. For information about express
  * see {@link http://expressjs.com}
  **/
  getApp() {
    return this.app;
  }

  /**
  * gets a reference to the redis instance. For information about redis
  * see {@link http://redis.io}
  **/
  getRedis() {
    return this.redis;
  }

  /**
  * gets a reference to the mongo instance. For information about mongo
  * see {@link http://mongodb.org}
  **/
  getMongo() {
    return this.mongo;
  }

  /**
  * gets a reference to the singleton that mongoose represents. For information about mongoose
  * see {@link http://mongoosejs.com/docs/api.html}
  **/
  getMongoose() {
    return mongoose;
  }

  /**
  * Starts server to listen for incoming connections as well as
  * connecting to be database
  */
  start() {
    this.log('starting server...');
    let pendingConnections = 2;

    const connected = (dbLog) => {
      pendingConnections--;
      dbLog('connection successful');

      if (pendingConnections === 0) {
        if (!this.config.server.slave) {
          this.server.listen(this.config.server.port);
          this.emit('started', this);
          this.log('server started');
        } else {
          this.emit('started', this);
          this.log('server is in slave mode');
        }
      }
    };

    this._createRedisConnection(connected);
    this._createMongoConnection(connected);
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
