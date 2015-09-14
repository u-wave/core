import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import readline from 'readline';
import express from 'express';
import redis from 'redis';
import debug from 'debug';

// APIs
import v1 from './routes/v1/api.js';

// config
import serverConfig from './config/server.json';
import mongoConfig from './config/mongo.json';
import apiConfig from './config/api.json';

const app = express();
const mongo = mongoose.connection;

const serverLog = debug("uwave:server");
const mongoLog = debug("uwave:database:mongo");

mongo.on('error', e => mongoLog(e));
mongo.on('reconnected', () => mongoLog("reconnected"));
mongo.on('disconnected', () => mongoLog("disconnected"))

mongo.once('open', () => {
  // Initialize app now that we have a connection to the database
  mongoLog('connection successfull');
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // here you can invoke further API versions
  v1(app, apiConfig.v1);
});


// workaround to properly close all connections on termination.
if(process.platform === "win32") {
  readline.createInterface({
    'input': process.stdin,
    'output': process.stdout
  }).on('SIGINT', () => process.emit('SIGINT'));
}

process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    mongoLog('closing connection to mongo');
    process.exit(0);
  });
});

mongoLog(`connecting to database '${mongoConfig.host}/uwave'...`);
mongoose.connect(`mongodb://${mongoConfig.host}/uwave:${mongoConfig.port}`, mongoConfig.options);