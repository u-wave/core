import { expect } from 'chai';
import mongoose from 'mongoose';
import delay from 'delay';
import uwave from '../src';

describe('üWave Core', () => {
  let uw;
  beforeEach(() => {
    uw = uwave({
      mongo: mongoose.createConnection('mongodb://localhost:27017/uw_test_server'),
    });
  });
  afterEach(async () => {
    await uw.stop();
  });

  it('can create a üWave instance', async () => {
    expect(uw).to.be.instanceOf(uwave.Uwave);
    await delay(50); // HACK Give mongo some time to connect
  });
});
