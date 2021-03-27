'use strict';

/**
 * @param {import('../Uwave')} uw
 */
function getWaitingUserIDs(uw) {
  return uw.redis.lrange('waitlist', 0, -1);
}

/**
 * @param {import('../Uwave')} uw
 * @param {import('mongodb').ObjectID} userID
 */
async function removeFromWaitlist(uw, userID) {
  const id = userID.toString();
  const waitingIDs = await getWaitingUserIDs(uw);
  if (waitingIDs.includes(id)) {
    await uw.redis.lrem('waitlist', 0, id);
    uw.publish('waitlist:leave', {
      userID: id,
      waitlist: await getWaitingUserIDs(uw),
    });
  }
}

module.exports = removeFromWaitlist;
