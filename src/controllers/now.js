const props = require('p-props');
const { getBoothData } = require('./booth');
const { serializePlaylist } = require('../utils/serialize');

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

// eslint-disable-next-line import/prefer-default-export
async function getState(req) {
  const uw = req.uwave;
  const { authRegistry } = req.uwaveHttp;
  const { passport } = uw;
  const { user } = req;

  const motd = uw.motd.get();
  const users = getOnlineUsers(uw);
  const guests = getGuestsCount(uw);
  const roles = uw.acl.getAllRoles();
  const booth = getBoothData(uw);
  const waitlist = uw.waitlist.getUserIDs();
  const waitlistLocked = uw.waitlist.isLocked();
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

exports.getState = getState;
