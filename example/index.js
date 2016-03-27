import express from 'express';
import { Buffer } from 'buffer';

import uwave from 'u-wave-core';
import createWebApi from 'u-wave-api-v1';
import createWebClient from 'u-wave-web';

const port = process.env.PORT || 80;

const config = require('./config.json');

const uw = uwave(config);

const app = express();
const server = app.listen(port);

app.use('/v1', createWebApi(uw, {
  secret: new Buffer(config.secret),
  // The web API needs an HTTP server to attach the WebSocket server to.
  server: server
}));
app.use(createWebClient(uw, {
  apiBase: '/v1'
}));

uw.on('started', () => {
  console.log(`üWave server running on http://localhost:${port}/`);
});

process.on('exit', () => {
  uw.stop();
  server.close();
});
