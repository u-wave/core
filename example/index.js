const express = require('express');
const { Buffer } = require('buffer');
const uwave = require('u-wave-core');
const { createHttpApi, createSocketServer } = require('u-wave-http-api');
const createWebClient = require('u-wave-web/middleware').default;
const youTubeSource = require('u-wave-source-youtube');
const soundCloudSource = require('u-wave-source-soundcloud');

const port = process.env.PORT || 80;

const config = require('./config.json');

const uw = uwave(config);

// Register your Media Sources. The API keys are configured in the config.json
// file.
uw.source(youTubeSource, config.youtube);
uw.source(soundCloudSource, config.soundcloud);

const secret = Buffer.from(config.secret);

const httpApi = createHttpApi(uw, {
  secret,
});

const webClient = createWebClient(uw, {
  apiBase: '/api',
});

const app = express();
const server = app.listen(port);

app.use('/api', httpApi);

createSocketServer(uw, {
  // This needs an HTTP server to attach the WebSocket server to.
  server,
  secret,
});

app.use(webClient);

uw.on('started', () => {
  console.log(`üWave server running on http://localhost:${port}/`);
});

process.on('exit', () => {
  uw.stop();
  server.close();
});
