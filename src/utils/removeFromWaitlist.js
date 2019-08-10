function getWaitingUserIDs(uw) {
  return uw.redis.lrange('waitlist', 0, -1);
}

export default async function removeFromWaitlist(uw, userID) {
  const waitingIDs = await getWaitingUserIDs(uw);
  if (waitingIDs.includes(userID)) {
    await uw.redis.lrem('waitlist', 0, userID);
    uw.publish('waitlist:leave', {
      userID,
      waitlist: await getWaitingUserIDs(uw),
    });
  }
}
