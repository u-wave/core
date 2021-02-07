'use strict';

const getPort = require('get-port');
const jwt = require('jsonwebtoken');
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

  uw.createTestSessionToken = async (user) => {
    const token = await jwt.sign(
      { id: user.id },
      uw.options.secret,
      { expiresIn: '1d' },
    );
    return token;
  };

  uw.destroy = async () => {
    await uw.close();
    await deleteDatabase(mongoUrl);
  };

  await uw.listen();

  return uw;
}

module.exports = createUwave;
