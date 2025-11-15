/**
 * @param {import('../Uwave.js').default} uw
 */
function getCurrentDJ(uw) {
  return uw.keyv.get('booth:currentDJ');
}

/**
 * @param {import('../Uwave.js').default} uw
 * @param {import('../schema.js').UserID} userID
 */
async function skipIfCurrentDJ(uw, userID) {
  const currentDJ = await getCurrentDJ(uw);
  if (userID.toString() === currentDJ) {
    await uw.booth.advance({ remove: true });
  }
}

export default skipIfCurrentDJ;
