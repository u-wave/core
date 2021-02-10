'use strict';

const aclRoleSchema = require('./AclRole');
const authenticationSchema = require('./Authentication');
const historySchema = require('./History');
const mediaSchema = require('./Media');
const playlistSchema = require('./Playlist');
const playlistItemSchema = require('./PlaylistItem');
const userSchema = require('./User');

async function models(uw) {
  uw.models = {
    AclRole: uw.mongo.model('AclRole', aclRoleSchema),
    Authentication: uw.mongo.model('Authentication', authenticationSchema),
    HistoryEntry: uw.mongo.model('History', historySchema),
    Media: uw.mongo.model('Media', mediaSchema),
    Playlist: uw.mongo.model('Playlist', playlistSchema),
    PlaylistItem: uw.mongo.model('PlaylistItem', playlistItemSchema),
    User: uw.mongo.model('User', userSchema),
  };
}

module.exports = models;
