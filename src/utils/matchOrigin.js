'use strict';

const { escapeRegExp } = require('lodash');

function memoize(fn) {
  let lastArg;
  let lastReturn;
  return (arg) => {
    if (arg !== lastArg) {
      lastArg = arg;
      lastReturn = fn(arg);
    }
    return lastReturn;
  };
}

const getAllowedOriginsRegExp = memoize((allowedOrigins) => {
  function singleOriginToRegExp(origin) {
    return escapeRegExp(origin).replace('\\*', () => '.+?');
  }

  return new RegExp(`^(?:${allowedOrigins.map(singleOriginToRegExp)})$`);
});

function matchOrigin(origin, allowedOrigins) {
  if (allowedOrigins.length === 0) {
    return false;
  }

  return getAllowedOriginsRegExp(allowedOrigins).test(origin);
}

module.exports = matchOrigin;
