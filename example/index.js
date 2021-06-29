const { Buffer } = require('buffer');
const uwave = require('u-wave-core');
const createWebClient = require('u-wave-web/middleware').default;
const youTubeSource = require('u-wave-source-youtube');
const soundCloudSource = require('u-wave-source-soundcloud');
const dotenv = require('dotenv');

dotenv.config();

const port = process.env.PORT || 80;
const secret = Buffer.from(process.env.SECRET, 'hex');

const DEFAULT_MONGO_URL = 'mongodb://localhost:27017/uwave';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

const uw = uwave({
  mongo: process.env.MONGO_CONNECTION_URL || DEFAULT_MONGO_URL,
  redis: process.env.REDIS_CONNECTION_URL || DEFAULT_REDIS_URL,
  port,
  secret,
  // This has to be disabled so the headers do not get added to the web client too.
  helmet: false,
});

uw.use(async () => {
  // Register your Media Sources. The API keys are configured in the config.json
  // file.
  uw.source(youTubeSource, {
    key: process.env.YOUTUBE_API_KEY,
  });
  uw.source(soundCloudSource, {
    key: process.env.SOUNDCLOUD_API_KEY,
  });
});

uw.use(async () => {
  const webClient = createWebClient(null, {
    apiBase: '/api',
  });

  uw.express.use(webClient);
});

uw.listen().then(() => {
  console.log(`üWave server running on http://localhost:${port}/`);
}, (err) => {
  console.error(err.stack);
  process.exit(1);
});

process.on('beforeExit', () => {
  uw.close();
});
