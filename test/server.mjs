import assert from 'assert';
import { Uwave } from 'u-wave-core';
import createUwave from './utils/createUwave.mjs';

describe('üWave Core', () => {
  let uw;
  beforeEach(async () => {
    uw = await createUwave('core');
  });
  afterEach(async () => {
    await uw.destroy();
  });

  it('can create a üWave instance', async () => {
    assert(uw instanceof Uwave);
  });
});
