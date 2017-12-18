module.exports = (api) => {
  // TODO configure this maybe
  api.cache.never();

  return {
    presets: [
      ['@babel/preset-env', {
        targets: { node: 6 },
      }],
    ],
    plugins: [
      'babel-plugin-transform-promise-to-bluebird',
      '@babel/plugin-proposal-object-rest-spread',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-transform-flow-comments',
    ],
  };
};
