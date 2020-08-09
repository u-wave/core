const aclRoleModel = require('./AclRole');
const authenticationModel = require('./Authentication');
const historyModel = require('./History');
const mediaModel = require('./Media');
const playlistModel = require('./Playlist');
const playlistItemModel = require('./PlaylistItem');
const userModel = require('./User');

async function models(uw) {
  aclRoleModel()(uw);
  authenticationModel()(uw);
  historyModel()(uw);
  mediaModel()(uw);
  playlistModel()(uw);
  playlistItemModel()(uw);
  userModel()(uw);

  uw.models = {
    AclRole: uw.model('AclRole'),
    Authentication: uw.model('Authentication'),
    HistoryEntry: uw.model('History'),
    Media: uw.model('Media'),
    Playlist: uw.model('Playlist'),
    PlaylistItem: uw.model('PlaylistItem'),
    User: uw.model('User'),
  };
}

module.exports = models;
