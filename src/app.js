import path from 'path';
import UWaveServer from './server';

// API
import V1 from 'u-wave-api-v1';

// config
import serverConfig from './config/uwave';
serverConfig.cert = path.normalize(path.join(__dirname, '../test.cert'));

const server = new UWaveServer(serverConfig);
const v1 = new V1(serverConfig);

server.on('stopped', () => process.exit(0));
server.on('started', uwave => {
  v1.registerModels(uwave);
  v1.registerWSServer(uwave);
});

server.registerAPI('/v1', v1.getRouter());
server.start();

server.server.listen(serverConfig.server.port);
