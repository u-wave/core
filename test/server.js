'use strict';

const assert = require('assert');
const delay = require('delay');
const uwave = require('..');

const DB_HOST = process.env.MONGODB_HOST || 'localhost';

describe('üWave Core', () => {
  let uw;
  beforeEach(async () => {
    uw = uwave({
      mongo: `mongodb://${DB_HOST}/uw_test_server`,
      secret: 'uw_test_secret',
    });
    await uw.ready();
  });
  afterEach(async () => {
    await uw.close();
  });

  it('can create a üWave instance', async () => {
    assert(uw instanceof uwave.Uwave);
    await delay(50); // HACK Give mongo some time to connect
  });
});
