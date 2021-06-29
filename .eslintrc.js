'use strict';

const pkg = require('./package.json');

module.exports = {
  extends: ['airbnb-base', 'plugin:node/recommended'],

  plugins: ['node'],

  // We don't use babel for transpiling, but we do use features
  // supported by Node.js that the default eslint parser does not
  // yet understand.
  parser: '@babel/eslint-parser',
  parserOptions: {
    sourceType: 'script',
    requireConfigFile: false,
    babelOptions: {
      plugins: ['@babel/plugin-syntax-class-properties'],
    },
  },

  rules: {
    // We're not transpiling
    strict: ['error', 'global'],

    'node/no-unpublished-require': 'off',

    // MongoDB IDs
    'no-underscore-dangle': ['error', { allow: ['_id'] }],
    // Used by plugins
    'no-param-reassign': ['error', { props: false }],
    // I disagree that this is bad
    'max-classes-per-file': 'off',
    // Allow `continue` in loops
    'no-continue': ['off'],
    // Allow `for..of`
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ForInStatement',
        message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
      },
      {
        selector: 'LabeledStatement',
        message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
      },
      {
        selector: 'WithStatement',
        message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
      },
    ],
  },

  overrides: [
    {
      files: ['*.mjs'],
      rules: {
        'import/extensions': ['error', 'ignorePackages'],
        'import/no-unresolved': ['error', {
          ignore: [pkg.name], // not ideal!
        }],
      },
      settings: {
        node: {
          allowModules: [pkg.name],
        },
      },
    },
    {
      files: ['test/**/*.js'],
      env: {
        mocha: true,
      },
      rules: {
        'node/no-unpublished-require': 'off',
      },
    },
    {
      files: ['test/**/*.mjs'],
      env: {
        mocha: true,
      },
    },
  ],
};
