const assert = require('assert');
const delay = require('delay');
const uwave = require('..');

describe('üWave Core', () => {
  let uw;
  beforeEach(() => {
    uw = uwave({
      mongo: 'mongodb://localhost:27017/uw_test_server',
      secret: 'uw_test_secret',
    });
  });
  afterEach(async () => {
    await uw.stop();
  });

  it('can create a üWave instance', async () => {
    assert(uw instanceof uwave.Uwave);
    await delay(50); // HACK Give mongo some time to connect
  });
});
