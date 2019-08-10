import ms from 'ms';
import { promisify } from 'util';
import RateLimiterBase from 'ratelimiter';
import wrapMiddleware from '../utils/wrapMiddleware';
import { RateLimitError } from '../errors';

class RateLimiter extends RateLimiterBase {}
RateLimiter.prototype.getAsync = promisify(RateLimiter.prototype.get);

export default function rateLimit(prefix, opts) {
  const RLError = opts.error || RateLimitError;

  return wrapMiddleware(async (req, res) => {
    const uw = req.uwave;

    const limiter = new RateLimiter({
      ...opts,
      id: `${prefix}${req.user ? req.user.id : req.socket.remoteAddress}`,
      db: uw.redis,
    });

    const limit = await limiter.getAsync();

    res.set('X-RateLimit-Limit', limit.total);
    res.set('X-RateLimit-Remaining', limit.remaining - 1);
    res.set('X-RateLimit-Reset', limit.reset);

    if (limit.remaining) return;

    const retryAfter = Math.floor(limit.reset - (Date.now() / 1000));
    res.set('Retry-After', retryAfter);

    throw new RLError({
      retryAfter: ms(retryAfter * 1000, { long: true }),
    });
  });
}
