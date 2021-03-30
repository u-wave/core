'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

const listOfUsers = [{ type: Types.ObjectId, ref: 'User' }];

/**
 * @typedef {object} HistoryMedia
 * @prop {import('mongodb').ObjectID} media
 * @prop {string} artist
 * @prop {string} title
 * @prop {number} start
 * @prop {number} end
 */

/**
 * @typedef {object} LeanHistoryEntry
 * @prop {import('mongodb').ObjectID} _id
 * @prop {import('mongodb').ObjectID} user
 * @prop {import('mongodb').ObjectID} playlist
 * @prop {import('mongodb').ObjectID} item
 * @prop {HistoryMedia} media
 * @prop {Date} playedAt
 * @prop {import('mongodb').ObjectID[]} upvotes
 * @prop {import('mongodb').ObjectID[]} downvotes
 * @prop {import('mongodb').ObjectID[]} favorites
 */

/**
 * @typedef {import('mongoose').Document<LeanHistoryEntry["_id"]> & LeanHistoryEntry} HistoryEntry
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
      /** @type {(name: string) => string} */
      set: (artist) => artist.normalize('NFKC'),
    },
    title: {
      type: String,
      index: true,
      /** @type {(name: string) => string} */
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
