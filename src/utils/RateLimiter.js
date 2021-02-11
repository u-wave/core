'use strict';

const { promisify } = require('util');
const RateLimiterBase = require('ratelimiter');

class RateLimiter extends RateLimiterBase {}
RateLimiter.prototype.getAsync = promisify(RateLimiter.prototype.get);

module.exports = RateLimiter;
