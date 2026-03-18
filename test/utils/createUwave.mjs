import getPort from 'get-port';
import uwave from 'u-wave-core';
import testPlugin from './plugin.mjs';

async function createUwave(name, options) {
  const port = await getPort();

  const uw = uwave({
    ...options,
    port,
    sqlite: ':memory:',
    secret: Buffer.from(`secret_${name}`),
    logger: {
      level: 'error',
    },
  });

  uw.use(testPlugin);

  await uw.listen();

  return uw;
}

export default createUwave;
