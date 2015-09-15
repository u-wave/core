import bodyParser from 'body-parser';
import EventEmitter from 'events';
import mongoose from 'mongoose';
import readline from 'readline';
import express from 'express';
import redis from 'redis';
import debug from 'debug';

export default class UWaveServer extends EventEmitter {
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
    if (process.platform === "win32") {
      readline.createInterface({
        'input': process.stdin,
        'output': process.stdout
      }).on('SIGINT', () => process.emit('SIGINT'));
    }

    process.on('SIGINT', () => { this.stop(); });
  }

  registerAPI(path, router) {
    if (typeof path !== "string") throw new Error("path has to be of type string");
    if (typeof router instanceof express.Router) throw new Error("path has to be an instance of router");

    this.app.use(path, router);
  }

  start() {
    this.log('starting server...');

    this.mongo.once('open', () => {
      this.mongoLog('connection successful');
      this.app.listen(this.config.server.port);
      this.emit('started');
    });

    mongoose.connect(`mongodb://${this.config.mongo.host}/uwave:${this.config.mongo.port}`, this.config.mongo.options);
  }

  stop() {
    this.log('stopping server...');

    mongoose.connection.close(() => {
      this.mongoLog('connection closed');
      this.emit('stopped');
    });
  }
}
