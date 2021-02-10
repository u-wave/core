'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

const listOfUsers = [{ type: Types.ObjectId, ref: 'User' }];

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
