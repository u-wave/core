'use strict';

/**
 * @param {import('../Uwave')} uw
 */
function getCurrentDJ(uw) {
  return uw.redis.get('booth:currentDJ');
}

/**
 * @param {import('../Uwave')} uw
 * @param {import('mongodb').ObjectID} userID
 */
async function skipIfCurrentDJ(uw, userID) {
  const currentDJ = await getCurrentDJ(uw);
  if (userID === currentDJ) {
    await uw.booth.advance({ remove: true });
  }
}

module.exports = skipIfCurrentDJ;
