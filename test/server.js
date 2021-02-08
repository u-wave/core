'use strict';

const assert = require('assert');
const uwave = require('..');
const createUwave = require('./utils/createUwave');

describe('üWave Core', () => {
  let uw;
  beforeEach(async () => {
    uw = await createUwave('core');
  });
  afterEach(async () => {
    await uw.destroy();
  });

  it('can create a üWave instance', async () => {
    assert(uw instanceof uwave.Uwave);
  });
});
