import { setTimeout } from 'node:timers/promises';

/** Retry the `fn` until it doesn't throw, or until the duration in milliseconds has elapsed. */
export async function retryFor(duration, fn) {
  const end = Date.now() + duration;
  let caughtError;
  while (Date.now() < end) {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      caughtError = err;
    }
    await setTimeout(10);
  }

  if (caughtError != null) {
    throw new Error(`Failed after ${duration}ms`, { cause: caughtError });
  }
}
