'use strict';

const getPort = require('get-port');
const Redis = require('ioredis');
const deleteDatabase = require('./deleteDatabase');
const uwave = require('../..');
const testPlugin = require('./plugin');

const DB_HOST = process.env.MONGODB_HOST || 'localhost';

async function createUwave(name, options) {
  const mongoUrl = `mongodb://${DB_HOST}/uw_test_${name}`;
  const port = await getPort();

  const uw = uwave({
    ...options,
    port,
    mongo: mongoUrl,
    secret: Buffer.from(`secret_${name}`),
  });

  uw.use(testPlugin);

  uw.destroy = async () => {
    await uw.close();

    // Clear state between test runs.
    const redis = new Redis('redis://localhost:6379');
    await redis.flushall();
    await redis.quit();

    await deleteDatabase(mongoUrl);
  };

  await uw.listen();

  return uw;
}

module.exports = createUwave;
