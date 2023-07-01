/**
 * @param {import('../Uwave.js').default} uw
 */
function getWaitingUserIDs(uw) {
  return uw.redis.lrange('waitlist', 0, -1);
}

/**
 * @param {import('../Uwave.js').default} uw
 * @param {import('mongodb').ObjectId} userID
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

export default removeFromWaitlist;
