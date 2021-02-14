'use strict';

const getPort = require('get-port');
const { once } = require('events');
const { spawn } = require('child_process');
const deleteDatabase = require('./deleteDatabase');
const uwave = require('../..');
const testPlugin = require('./plugin');

const DB_HOST = process.env.MONGODB_HOST || 'localhost';

/**
 * Create an in-memory redis database to run tests against.
 */
async function createIsolatedRedis() {
  const port = await getPort();

  const proc = spawn('redis-server', ['-']);
  proc.stdin.end(`
    port ${port}
    save ""
  `);

  await once(proc, 'spawn');

  for await (const buf of proc.stdout) {
    if (buf.toString().includes('Ready to accept connections')) {
      break;
    }
  }

  return {
    port,
    proc,
  };
}

async function createUwave(name, options) {
  const redisServer = await createIsolatedRedis();
  const mongoUrl = `mongodb://${DB_HOST}/uw_test_${name}`;

  const port = await getPort();

  const uw = uwave({
    ...options,
    port,
    redis: `redis://localhost:${redisServer.port}`,
    mongo: mongoUrl,
    secret: Buffer.from(`secret_${name}`),
  });

  uw.use(testPlugin);

  uw.destroy = async () => {
    await uw.close();

    redisServer.proc.kill('SIGINT');
    await once(redisServer.proc, 'close');

    await deleteDatabase(mongoUrl);
  };

  await uw.listen();

  return uw;
}

module.exports = createUwave;
