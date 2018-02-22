const express = require('express');
const { Buffer } = require('buffer');
const uwave = require('u-wave-core');
const createWebApi = require('u-wave-http-api');
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

const app = express();
const server = app.listen(port);

app.use('/api', createWebApi(uw, {
  secret: Buffer.from(config.secret),
  // The web API needs an HTTP server to attach the WebSocket server to.
  server: server
}));
app.use(createWebClient(uw, {
  apiBase: '/api'
}));

uw.on('started', () => {
  console.log(`üWave server running on http://localhost:${port}/`);
});

process.on('exit', () => {
  uw.stop();
  server.close();
});
