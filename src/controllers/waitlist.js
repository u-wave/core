const toItemResponse = require('../utils/toItemResponse');
const toListResponse = require('../utils/toListResponse');

async function getWaitlist(req) {
  const { waitlist } = req.uwave;

  const list = await waitlist.getUserIDs();

  return toListResponse(list, { url: req.fullUrl });
}

// POST waitlist/ entry point: used both for joining the waitlist,  and for
// adding someone else to the waitlist.
async function addToWaitlist(req) {
  const { user: moderator } = req;
  const { userID } = req.body;
  const { waitlist } = req.uwave;

  await waitlist.addUser(userID, { moderator });

  const updated = await waitlist.getUserIDs();

  return toListResponse(updated, { url: req.fullUrl });
}

async function moveWaitlist(req) {
  const { user: moderator } = req;
  const { userID, position } = req.body;
  const { waitlist } = req.uwave;

  await waitlist.moveUser(userID, position, { moderator });

  const updated = await waitlist.getUserIDs();

  return toListResponse(updated, { url: req.fullUrl });
}

async function removeFromWaitlist(req) {
  const { user: moderator } = req;
  const { id: userID } = req.params;
  const { waitlist } = req.uwave;

  await waitlist.removeUser(userID, { moderator });

  const updated = await waitlist.getUserIDs();

  return toListResponse(updated, { url: req.fullUrl });
}

async function clearWaitlist(req) {
  const { user: moderator } = req;
  const { waitlist } = req.uwave;

  await waitlist.clear({ moderator });

  const updated = await waitlist.getUserIDs();

  return toListResponse(updated, { url: req.fullUrl });
}

async function lockWaitlist(req) {
  const { user: moderator } = req;
  const { lock } = req.body;
  const { waitlist } = req.uwave;

  if (lock) {
    await waitlist.lock({ moderator });
  } else {
    await waitlist.unlock({ moderator });
  }

  return toItemResponse({ locked: lock }, { url: req.fullUrl });
}

exports.getWaitlist = getWaitlist;
exports.addToWaitlist = addToWaitlist;
exports.moveWaitlist = moveWaitlist;
exports.removeFromWaitlist = removeFromWaitlist;
exports.clearWaitlist = clearWaitlist;
exports.lockWaitlist = lockWaitlist;
