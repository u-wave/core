'use strict';

const pkg = require('./package.json');

module.exports = {
  extends: ['airbnb-base', 'plugin:node/recommended', 'plugin:@typescript-eslint/recommended'],

  plugins: ['node', '@typescript-eslint'],

  parserOptions: {
    sourceType: 'script',
  },

  rules: {
    'import/extensions': ['error', 'ignorePackages'],
    'import/prefer-default-export': 'off',
    'import/no-extraneous-dependencies': ['error', {
      devDependencies: [
        'test/**',
        'dev/**',
        '**/.eslintrc.js',
      ],
      optionalDependencies: false,
    }],
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
      files: ['*.cjs'],
      rules: {
        strict: ['error', 'global'],
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        sourceType: 'module',
      },
      rules: {
        'node/no-unsupported-features/es-syntax': 'off',
      },
    },
    {
      files: ['*.mjs'],
      parserOptions: {
        sourceType: 'module',
      },
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
      rules: {
        'node/no-unpublished-import': 'off',
      },
    },
  ],
};
