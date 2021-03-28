'use strict';

const { escapeRegExp } = require('lodash');

/**
 * @template TArg,TRet
 * @param {(arg: TArg) => TRet} fn
 * @returns {(arg: TArg) => TRet}
 */
function memoize(fn) {
  /** @type {TArg} */
  let lastArg;
  /** @type {TRet} */
  let lastReturn;
  return (arg) => {
    if (arg !== lastArg || lastArg === undefined) {
      lastArg = arg;
      lastReturn = fn(arg);
    }
    return lastReturn;
  };
}

/**
 * @type {(origins: string[]) => RegExp}
 */
const getAllowedOriginsRegExp = memoize((allowedOrigins) => {
  /**
   * @param {string} origin
   * @returns {string}
   */
  function singleOriginToRegExp(origin) {
    return escapeRegExp(origin).replace('\\*', () => '.+?');
  }

  return new RegExp(`^(?:${allowedOrigins.map(singleOriginToRegExp).join('|')})$`);
});

/**
 * @param {string} origin
 * @param {string[]} allowedOrigins
 * @returns {boolean}
 */
function matchOrigin(origin, allowedOrigins) {
  if (allowedOrigins.length === 0) {
    return false;
  }

  return getAllowedOriginsRegExp(allowedOrigins).test(origin);
}

module.exports = matchOrigin;
