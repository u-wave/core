import { expect } from 'chai';

import uwave from '../src';
import testConfig from './test-server-config.json';

describe('üWave Core', () => {
  it('can create a üWave instance', () => {
    expect(uwave(testConfig)).to.be.instanceOf(uwave.Uwave);
  });
});
