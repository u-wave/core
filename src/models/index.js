'use strict';

const aclRoleModel = require('./AclRole');
const authenticationModel = require('./Authentication');
const historyModel = require('./History');
const mediaModel = require('./Media');
const playlistModel = require('./Playlist');
const playlistItemModel = require('./PlaylistItem');
const userModel = require('./User');

async function models(uw) {
  uw.use(aclRoleModel);
  uw.use(authenticationModel);
  uw.use(historyModel);
  uw.use(mediaModel);
  uw.use(playlistModel);
  uw.use(playlistItemModel);
  uw.use(userModel);

  uw.use(async () => {
    uw.models = {
      AclRole: uw.model('AclRole'),
      Authentication: uw.model('Authentication'),
      HistoryEntry: uw.model('History'),
      Media: uw.model('Media'),
      Playlist: uw.model('Playlist'),
      PlaylistItem: uw.model('PlaylistItem'),
      User: uw.model('User'),
    };
  });
}

module.exports = models;
