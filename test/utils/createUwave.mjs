import uwave from 'u-wave-core';
import testPlugin from './plugin.mjs';

async function createUwave(name, options, plugins = []) {
  const uw = uwave({
    ...options,
    sqlite: ':memory:',
    secret: Buffer.from(`secret_${name}`),
    logger: {
      level: 'error',
    },
  });

  uw.use(testPlugin);
  for (const plugin of plugins) {
    uw.use(plugin);
  }

  await uw.listen();

  return uw;
}

export default createUwave;
