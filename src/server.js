import bodyParser from 'body-parser';
import EventEmitter from 'events';
import mongoose from 'mongoose';
import readline from 'readline';
import express from 'express';
import redis from 'redis';
import debug from 'debug';

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
    this.mongo = mongoose.connection;

    this.log = debug('uwave:server');
    this.mongoLog = debug('uwave:mongo');

    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));

    /* ======== mongo events ======== */
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
  * gets the express.app instance. For information about express
  * see {@link http://expressjs.com}
  **/
  getApp() {
    return this.app;
  }

  /**
  * Starts server to listen for incoming connections as well as
  * connecting to be database
  */
  start() {
    this.log('starting server...');

    this.mongo.once('open', () => {
      this.mongoLog('connection successful');
      this.app.listen(this.config.server.port);
      this.emit('started');
      this.log('server started');
    });

    mongoose.connect(`mongodb://${this.config.mongo.host}:${this.config.mongo.port}/uwave`, this.config.mongo.options);
  }

  /**
  * Stops the server
  */
  stop() {
    this.log('stopping server...');

    mongoose.connection.close(() => {
      this.mongoLog('connection closed');
      this.emit('stopped');
    });
  }
}
