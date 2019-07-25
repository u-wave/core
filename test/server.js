import { expect } from 'chai';
import { createServer } from 'http';
import mongoose from 'mongoose';
import delay from 'delay';
import uwave from '../src';

describe('üWave Core', () => {
  let uw;
  let server;
  beforeEach(() => {
    server = createServer();
    uw = uwave({
      mongo: mongoose.createConnection('mongodb://localhost:27017/uw_test_server', { useNewUrlParser: true }),
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
