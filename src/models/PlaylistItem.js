'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

/**
 * @typedef {object} LeanPlaylistItem
 * @prop {import('mongodb').ObjectID} _id
 * @prop {import('mongodb').ObjectID} media
 * @prop {string} artist
 * @prop {string} title
 * @prop {number} start
 * @prop {number} end
 * @prop {Date} createdAt
 * @prop {Date} updatedAt
 *
 * @typedef {import('mongoose').Document<LeanPlaylistItem["_id"]> & LeanPlaylistItem} PlaylistItem
 */

const schema = new Schema({
  media: {
    type: Types.ObjectId,
    ref: 'Media',
    required: true,
    index: true,
  },
  artist: {
    type: String,
    max: 128,
    required: true,
    index: true,
    /** @type {(name: string) => string} */
    set: (artist) => artist.normalize('NFKC'),
  },
  title: {
    type: String,
    max: 128,
    required: true,
    index: true,
    /** @type {(name: string) => string} */
    set: (title) => title.normalize('NFKC'),
  },
  start: { type: Number, min: 0, default: 0 },
  end: { type: Number, min: 0, default: 0 },
}, {
  timestamps: true,
  minimize: false,
});

module.exports = schema;
