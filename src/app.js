import UWaveServer from './server';

// middleware
import rateLimiter from './middleware/ratelimiter';
import permissions from './middleware/permissions';
import authenticator from './middleware/authenticator';

// API
import v1 from './apis/v1/api';

// config
import config from './config/uwave';

const server = new UWaveServer(config);
const middleware = [
  rateLimiter,
  authenticator,
  permissions
];

server.on('stopped', () => {
  process.exit(0);
});

server.registerAPI('/v1', v1(middleware));

server.start();
