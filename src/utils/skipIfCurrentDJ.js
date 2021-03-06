'use strict';

function getCurrentDJ(uw) {
  return uw.redis.get('booth:currentDJ');
}

async function skipIfCurrentDJ(uw, userID) {
  const currentDJ = await getCurrentDJ(uw);
  if (userID === currentDJ) {
    await uw.booth.advance({ remove: true });
  }
}

module.exports = skipIfCurrentDJ;
