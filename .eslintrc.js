const Module = require('module');
const { types, template, traverse } = require('@babel/core');

// Ensure babel-eslint uses our current Babel version.
// This is ABSOLUTELY TERRIBLE and should be removed ASAP when
// babel-eslint releases a new version.
const req = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === '@babel/types') return types;
  if (id === '@babel/template') return { default: template };
  if (id === '@babel/traverse') return { default: traverse };
  return req.call(this, id);
};

module.exports = {
  extends: 'airbnb-base',
  parser: 'babel-eslint',

  rules: {
    'no-underscore-dangle': ['error', { allow: ['_id'] }],
    'no-param-reassign': ['error', { props: false }],
  },
};
