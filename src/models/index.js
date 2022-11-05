'use strict';

const aclRoleSchema = require('./AclRole');
const authenticationSchema = require('./Authentication');
const configSchema = require('./Config');
const historySchema = require('./History');
const mediaSchema = require('./Media');
const migrationSchema = require('./Migration');
const playlistSchema = require('./Playlist');
const playlistItemSchema = require('./PlaylistItem');
const userSchema = require('./User');
const assetSchema = require('./Asset');

/**
 * @typedef {import('./AclRole').AclRole} AclRole
 * @typedef {import('./Authentication').Authentication} Authentication
 * @typedef {import('./Config').Config} Config
 * @typedef {import('./History').HistoryEntry} HistoryEntry
 * @typedef {import('./Media').Media} Media
 * @typedef {import('./Migration').Migration} Migration
 * @typedef {import('./Playlist').Playlist} Playlist
 * @typedef {import('./PlaylistItem').PlaylistItem} PlaylistItem
 * @typedef {import('./User').User} User
 * @typedef {import('./Asset').Asset} Asset
 * @typedef {{
 *  AclRole: import('mongoose').Model<AclRole, {}, {}>,
 *  Authentication: import('mongoose').Model<Authentication, {}, {}>,
 *  Config: import('mongoose').Model<Config, {}, {}>,
 *  HistoryEntry: import('mongoose').Model<HistoryEntry, {}, {}>,
 *  Media: import('mongoose').Model<Media, {}, {}>,
 *  Migration: import('mongoose').Model<Migration, {}, {}>,
 *  Playlist: import('mongoose').Model<Playlist, {}, {}>,
 *  PlaylistItem: import('mongoose').Model<PlaylistItem, {}, {}>,
 *  User: import('mongoose').Model<User, {}, {}>,
 *  Asset: import('mongoose').Model<Asset, {}, {}>,
 * }} Models
 */

/**
 * @param {import('../Uwave')} uw
 */
async function models(uw) {
  uw.models = {
    AclRole: uw.mongo.model('AclRole', aclRoleSchema),
    Authentication: uw.mongo.model('Authentication', authenticationSchema),
    Config: uw.mongo.model('Config', configSchema),
    HistoryEntry: uw.mongo.model('History', historySchema),
    Media: uw.mongo.model('Media', mediaSchema),
    Migration: uw.mongo.model('Migration', migrationSchema),
    Playlist: uw.mongo.model('Playlist', playlistSchema),
    PlaylistItem: uw.mongo.model('PlaylistItem', playlistItemSchema),
    User: uw.mongo.model('User', userSchema),
    Asset: uw.mongo.model('Asset', assetSchema),
  };
}

module.exports = models;
