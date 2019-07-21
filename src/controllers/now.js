import props from 'p-props';
import { getBoothData } from './booth';
import { serializePlaylist } from '../utils/serialize';

async function getFirstItem(user, activePlaylist) {
  const id = await activePlaylist;
  if (id) {
    try {
      const playlist = await user.getPlaylist(id);
      if (playlist) {
        const item = await playlist.getItemAt(0);
        return item;
      }
    } catch (e) {
      // Nothing
    }
  }
  return null;
}

function toInt(str) {
  if (typeof str !== 'string') return 0;
  if (!/^\d+$/.test(str)) return 0;
  return parseInt(str, 10);
}

async function getOnlineUsers(uw) {
  const { User } = uw.models;

  const userIDs = await uw.redis.lrange('users', 0, -1);
  return User.find({ _id: { $in: userIDs } });
}

async function getGuestsCount(uw) {
  const guests = await uw.redis.get('http-api:guests');
  return toInt(guests);
}

async function isWaitlistLocked(uw) {
  const lock = await uw.redis.get('waitlist:lock');
  return Boolean(lock);
}

// eslint-disable-next-line import/prefer-default-export
export async function getState(req) {
  const uw = req.uwave;
  const { authRegistry, passport } = req.uwaveHttp;
  const { user } = req;

  const motd = uw.getMotd();
  const users = getOnlineUsers(uw);
  const guests = getGuestsCount(uw);
  const roles = uw.acl.getAllRoles();
  const booth = getBoothData(uw);
  const waitlist = uw.redis.lrange('waitlist', 0, -1);
  const waitlistLocked = isWaitlistLocked(uw);
  const activePlaylist = user ? user.getActivePlaylistID() : null;
  const playlists = user ? user.getPlaylists() : null;
  const firstActivePlaylistItem = activePlaylist ? getFirstItem(user, activePlaylist) : null;
  const socketToken = user ? authRegistry.createAuthToken(user) : null;
  const authStrategies = passport.strategies();
  const time = Date.now();

  const state = await props({
    motd,
    user,
    users,
    guests,
    roles,
    booth,
    waitlist,
    waitlistLocked,
    activePlaylist,
    firstActivePlaylistItem,
    playlists,
    socketToken,
    authStrategies,
    time,
  });

  if (state.playlists) {
    state.playlists = state.playlists.map(serializePlaylist);
  }

  return state;
}
