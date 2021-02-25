'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

const listOfUsers = [{ type: Types.ObjectId, ref: 'User' }];

/**
 * @typedef {object} HistoryMedia
 * @prop {import('mongoose').Types.ObjectId} media
 * @prop {string} artist
 * @prop {string} title
 * @prop {number} start
 * @prop {number} end
 *
 * @typedef {object} LeanHistoryEntry
 * @prop {import('mongoose').Types.ObjectId} _id
 * @prop {import('mongoose').Types.ObjectId} user
 * @prop {import('mongoose').Types.ObjectId} playlist
 * @prop {import('mongoose').Types.ObjectId} item
 * @prop {Date} playedAt
 * @prop {import('mongoose').Types.ObjectId[]} upvotes
 * @prop {import('mongoose').Types.ObjectId[]} downvotes
 * @prop {import('mongoose').Types.ObjectId[]} favorites
 *
 * @typedef {import('mongoose').Document<LeanHistoryEntry>} HistoryEntry
 */

const schema = new Schema({
  user: {
    type: Types.ObjectId, ref: 'User', required: true, index: true,
  },
  playlist: { type: Types.ObjectId, ref: 'Playlist' },
  item: { type: Types.ObjectId, ref: 'PlaylistItem' },
  media: {
    media: { type: Types.ObjectId, ref: 'Media', required: true },
    artist: {
      type: String,
      index: true,
      set: (artist) => artist.normalize('NFKC'),
    },
    title: {
      type: String,
      index: true,
      set: (title) => title.normalize('NFKC'),
    },
    start: { type: Number, default: 0 },
    end: { type: Number, default: 0 },
  },
  playedAt: { type: Date, default: Date.now, index: true },
  upvotes: listOfUsers,
  downvotes: listOfUsers,
  favorites: listOfUsers,
}, {
  collection: 'historyentries',
  minimize: false,
});

module.exports = schema;
