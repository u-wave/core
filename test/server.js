import { expect } from 'chai';

import uwave, { Uwave } from '../';
import testConfig from './test-server-config.json';

describe('üWave Core', () => {
  it('can create a üWave instance', () => {
    expect(uwave(testConfig)).to.be.instanceOf(Uwave);
  });
});
