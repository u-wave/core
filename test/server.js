const { expect } = require('chai');
const { createServer } = require('http');
const delay = require('delay');
const uwave = require('..');

describe('üWave Core', () => {
  let uw;
  let server;
  beforeEach(() => {
    server = createServer();
    uw = uwave({
      mongo: 'mongodb://localhost:27017/uw_test_server',
      secret: 'uw_test_secret',
      server,
    });
  });
  afterEach(async () => {
    server.close();
    await uw.stop();
  });

  it('can create a üWave instance', async () => {
    expect(uw).to.be.instanceOf(uwave.Uwave);
    await delay(50); // HACK Give mongo some time to connect
  });
});
