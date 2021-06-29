'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

/**
 * @typedef {object} LeanPlaylist
 * @prop {import('mongodb').ObjectID} _id
 * @prop {string} name
 * @prop {string} description
 * @prop {import('mongodb').ObjectID} author
 * @prop {import('mongodb').ObjectID[]} media
 * @prop {Date} createdAt
 * @prop {Date} updatedAt
 *
 * @typedef {import('mongoose').Document<LeanPlaylist["_id"]> & LeanPlaylist & {
 *  readonly size: number
 * }} Playlist
 */

/**
 * @type {import('mongoose').Schema<Playlist, import('mongoose').Model<Playlist>>}
 */
const schema = new Schema({
  name: {
    type: String,
    min: 0,
    max: 128,
    required: true,
    /** @type {(name: string) => string} */
    set: (name) => name.normalize('NFKC'),
  },
  description: { type: String, min: 0, max: 512 },
  author: {
    type: Types.ObjectId, ref: 'User', required: true, index: true,
  },
  media: [{
    type: Types.ObjectId,
    ref: 'PlaylistItem',
    required: true,
    index: true,
  }],
}, {
  collection: 'playlists',
  timestamps: true,
  toJSON: { getters: true },
  minimize: false,
});

schema.virtual('size').get(/** @this {Playlist} */ function size() {
  return this.media.length;
});

module.exports = schema;
