import UWaveServer from './server';

// middleware
import rateLimiter from './middleware/ratelimiter';
import permissions from './middleware/permissions';
import authenticator from './middleware/authenticator';

// API
import v1 from './apis/v1/api';

// config
import serverConfig from './config/uwave';
import mwareConfig from './config/middleware';

const server = new UWaveServer(serverConfig);
const middleware = [
  authenticator,
  permissions
];

server.on('stopped', () => {
  process.exit(0);
});

server.registerMiddleware('/*', rateLimiter);
server.registerAPI('/v1', v1(middleware, mwareConfig));

server.start();
