import UWaveServer from './server';
import v1 from "./apis/v1/api";
import config from './config/uwave';

const server = new UWaveServer(config);

server.on('stopped', () => {
  process.exit(0);
});

server.registerAPI("/v1", v1());

server.start();
