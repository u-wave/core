'use strict';

const aclRoleSchema = require('./AclRole');
const authenticationSchema = require('./Authentication');
const historySchema = require('./History');
const mediaSchema = require('./Media');
const migrationSchema = require('./Migration');
const playlistSchema = require('./Playlist');
const playlistItemSchema = require('./PlaylistItem');
const userSchema = require('./User');

/**
 * @typedef {import('./AclRole').AclRole} AclRole
 * @typedef {import('./Authentication').Authentication} Authentication
 * @typedef {import('./History').HistoryEntry} HistoryEntry
 * @typedef {import('./Media').Media} Media
 * @typedef {import('./Migration').Migration} Migration
 * @typedef {import('./Playlist').Playlist} Playlist
 * @typedef {import('./PlaylistItem').PlaylistItem} PlaylistItem
 * @typedef {import('./User').User} User
 * @typedef {{
 *  AclRole: import('mongoose').Model<AclRole>,
 *  Authentication: import('mongoose').Model<Authentication>,
 *  HistoryEntry: import('mongoose').Model<HistoryEntry>,
 *  Media: import('mongoose').Model<Media>,
 *  Migration: import('mongoose').Model<Migration>,
 *  Playlist: import('mongoose').Model<Playlist>,
 *  PlaylistItem: import('mongoose').Model<PlaylistItem>,
 *  User: import('mongoose').Model<User>,
 * }} Models
 */

/**
 * @param {import('../Uwave')} uw
 */
async function models(uw) {
  uw.models = {
    AclRole: uw.mongo.model('AclRole', aclRoleSchema),
    Authentication: uw.mongo.model('Authentication', authenticationSchema),
    HistoryEntry: uw.mongo.model('History', historySchema),
    Media: uw.mongo.model('Media', mediaSchema),
    Migration: uw.mongo.model('Migration', migrationSchema),
    Playlist: uw.mongo.model('Playlist', playlistSchema),
    PlaylistItem: uw.mongo.model('PlaylistItem', playlistItemSchema),
    User: uw.mongo.model('User', userSchema),
  };
}

module.exports = models;
