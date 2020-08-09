const { Buffer } = require('buffer');
const uwave = require('u-wave-core');
const createWebClient = require('u-wave-web/middleware').default;
const youTubeSource = require('u-wave-source-youtube');
const soundCloudSource = require('u-wave-source-soundcloud');
const dotenv = require('dotenv');

dotenv.config();

const port = process.env.PORT || 80;
const secret = Buffer.from(process.env.SECRET, 'hex');

const uw = uwave({
  secret,
});

uw.use(() => {
  // Register your Media Sources. The API keys are configured in the config.json
  // file.
  uw.source(youTubeSource, {
    key: process.env.YOUTUBE_API_KEY,
  });
  uw.source(soundCloudSource, {
    key: process.env.SOUNDCLOUD_API_KEY,
  });
});

uw.use(() => {
  const webClient = createWebClient(null, {
    apiBase: '/api',
  });

  uw.express.use(webClient);
});

uw.ready().then(() => {
  console.log(`üWave server running on http://localhost:${port}/`);
});

process.on('beforeExit', () => {
  uw.close();
});
