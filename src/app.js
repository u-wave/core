import UWaveServer from './server';

// middleware
import limiter from 'express-rate-limit';
import authenticator from './middleware/authenticator';

// API
import v1 from 'u-wave-api-v1';

// config
import serverConfig from './config/uwave';
import wareConfig from './config/middleware';

const server = new UWaveServer(serverConfig);
const middleware = [
  //limiter(wareConfig.limiter),
  authenticator(wareConfig.authenticator)
];

server.on('stopped', () => {
  process.exit(0);
});

server.registerAPI('/v1', v1(middleware));

server.start();
