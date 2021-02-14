'use strict';

const { once } = require('events');
const { spawn } = require('child_process');
const getPort = require('get-port');
const Redis = require('ioredis');
const deleteDatabase = require('./deleteDatabase');
const uwave = require('../..');
const testPlugin = require('./plugin');

const DB_HOST = process.env.MONGODB_HOST || 'localhost';

/**
 * Create a separate in-memory redis instance to run tests against.
 * This way tests don't interfere with other redises on the system.
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

  async function close() {
    proc.kill('SIGINT');
    await once(proc, 'close');
  }

  return {
    url: `redis://localhost:${port}`,
    close,
  };
}

/**
 * Connect to Redis, setting up to completely clear the database at the end.
 * This can be used to run tests on CI.
 */
function createRedisConnection() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  async function close() {
    const redis = new Redis(url);
    await redis.flushall();
    await redis.quit();
  }

  return {
    url,
    close,
  };
}

async function createUwave(name, options) {
  const redisServer = process.env.REDIS_URL
    ? await createRedisConnection()
    : await createIsolatedRedis();
  const mongoUrl = `mongodb://${DB_HOST}/uw_test_${name}`;

  const port = await getPort();

  const uw = uwave({
    ...options,
    port,
    redis: redisServer.url,
    mongo: mongoUrl,
    secret: Buffer.from(`secret_${name}`),
  });

  uw.use(testPlugin);

  uw.destroy = async () => {
    try {
      await uw.close();
    } finally {
      await redisServer.close();
      await deleteDatabase(mongoUrl);
    }
  };

  await uw.listen();

  return uw;
}

module.exports = createUwave;
