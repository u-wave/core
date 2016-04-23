import { expect } from 'chai';

import uwave, { Uwave } from '../';

describe('üWave Core', () => {
  it('can create a üWave instance', () => {
    expect(
      uwave(require('./test-server-config'))
    ).to.be.instanceOf(Uwave);
  });
});
