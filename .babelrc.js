module.exports = (api) => {
  // TODO configure this maybe
  api.cache.never();

  return {
    plugins: [
      process.env.BABEL_ENV !== 'rollup' && '@babel/plugin-transform-modules-commonjs',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-proposal-private-methods',
      '@babel/plugin-transform-flow-comments',
    ].filter(Boolean),
  };
};
