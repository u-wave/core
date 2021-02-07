'use strict';

const getPort = require('get-port');
const deleteDatabase = require('./deleteDatabase');
const uwave = require('../..');

const DB_HOST = process.env.MONGODB_HOST || 'localhost';

async function createUwave(name) {
  const mongoUrl = `mongodb://${DB_HOST}/uw_test_${name}`;
  const port = await getPort();

  const uw = uwave({
    mongo: mongoUrl,
    secret: Buffer.from(`secret_${name}`),
  });

  uw.destroy = async () => {
    await uw.close();
    await deleteDatabase(mongoUrl);
  };

  await uw.listen();

  return uw;
}

module.exports = createUwave;
