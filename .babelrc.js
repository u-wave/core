module.exports = (api) => {
  // TODO configure this maybe
  api.cache.never();

  return {
    presets: [
      ['env', {
        targets: { node: 6 },
      }],
    ],
    plugins: [
      'transform-promise-to-bluebird',
      'transform-decorators',
      'transform-object-rest-spread',
      'transform-class-properties',
      'transform-export-extensions',
      'transform-flow-comments',
    ],
  };
};
