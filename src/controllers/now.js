import { getBoothData } from './booth.js';
import { serializeCurrentUser, serializePlaylist, serializeUser } from '../utils/serialize.js';
import { legacyPlaylistItem } from './playlists.js';
import { KEY_ACTIVE_SESSIONS } from '../SocketServer.js';

/**
 * @typedef {import('../schema.js').UserID} UserID
 */

/**
 * @param {import('../Uwave.js').default} uw
 * @param {import('../schema.js').Playlist & { size: number }} playlist
 */
async function getFirstItem(uw, playlist) {
  try {
    if (playlist.size > 0) {
      const { playlistItem, media } = await uw.playlists.getPlaylistItemAt(playlist, 0);
      return legacyPlaylistItem(playlistItem, media);
    }
  } catch {
    // Nothing
  }
  return null;
}

/**
 * @param {import('../Uwave.js').default} uw
 */
async function getOnlineUsers(uw) {
  const userIDs = /** @type {UserID[] | null} */ (await uw.keyv.get(KEY_ACTIVE_SESSIONS)) ?? [];
  if (userIDs.length === 0) {
    return [];
  }

  const users = await uw.users.getUsersByIds(userIDs);
  return users.map(serializeUser);
}

/**
 * @type {import('../types.js').Controller}
 */
async function getState(req) {
  const uw = req.uwave;
  const { authRegistry } = req.uwaveHttp;
  const { passport } = uw;
  const { user, sessionID } = req;

  // XXX: with sqlite there isn't really a point in making this all "parallel",
  // but maybe it makes sense to keep so it'd reduce network waiting times with
  // other databases in the future?
  const motd = uw.motd.get();
  const users = getOnlineUsers(uw);
  const roles = uw.acl.getAllRoles();
  const booth = getBoothData(uw);
  const waitlist = uw.waitlist.getUserIDs();
  const waitlistLocked = uw.waitlist.isLocked();
  const autoLeave = user != null ? uw.booth.getRemoveAfterCurrentPlay(user) : false;
  let activePlaylist = user?.activePlaylistID
    ? uw.playlists.getUserPlaylist(user, user.activePlaylistID).catch((error) => {
      // If the playlist was not found, our database is inconsistent. A deleted or nonexistent
      // playlist should never be listed as the active playlist. Most likely this is not the
      // user's fault, so we should not error out on `/api/now`. Instead, pretend they don't have
      // an active playlist at all. Clients can then let them select a new playlist to activate.
      if (error.code === 'NOT_FOUND' || error.code === 'playlist-not-found') {
        req.log.warn({ err: error }, 'The active playlist does not exist');
        return null;
      }
      throw error;
    })
    : Promise.resolve(null);
  const playlists = user
    ? uw.playlists.getUserPlaylists(user).then((playlists) => playlists.map(serializePlaylist))
    : null;
  const firstActivePlaylistItem = activePlaylist.then((playlist) => (
    playlist != null ? getFirstItem(uw, playlist) : null
  ));
  const socketToken = user ? authRegistry.createAuthToken(user, sessionID) : null;
  const authStrategies = passport.strategies();
  const time = Date.now();

  const stateShape = {
    motd,
    user: user ? serializeCurrentUser(user) : null,
    users,
    guests: uw.socketServer.guestCount,
    roles,
    booth,
    waitlist,
    waitlistLocked,
    autoLeave,
    activePlaylist: activePlaylist.then((playlist) => playlist?.id ?? null),
    firstActivePlaylistItem,
    playlists,
    socketToken,
    authStrategies,
    time,
  };

  const stateKeys = Object.keys(stateShape);
  const values = Object.values(stateShape);
  const stateValues = await Promise.all(values);

  const state = (
    // This is a little dirty but maintaining the exact type shape is very hard here.
    // We could solve that in the future by using a `p-props` style function. The npm
    // module `p-props` is a bit wasteful though.
    /** @type {{
      [key in keyof typeof stateShape]: Awaited<(typeof stateShape)[key]>
    }} */ (Object.fromEntries(
      stateKeys.map((key, i) => [key, stateValues[i]]),
    ))
  );

  for (const permission of Object.values(state.roles).flat()) {
    // Web client expects all permissions to be roles too.
    // This isn't how it works since #637.
    // Clients can still distinguish between roles and permissions using `.includes('.')`
    state.roles[permission] ??= [];
  }

  return state;
}

export { getState };
