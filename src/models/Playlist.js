'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

const schema = new Schema({
  name: {
    type: String,
    min: 0,
    max: 128,
    required: true,
    set: (name) => name.normalize('NFKC'),
  },
  description: { type: String, min: 0, max: 512 },
  author: {
    type: Types.ObjectId, ref: 'User', required: true, index: true,
  },
  shared: { type: Boolean, default: false },
  nsfw: { type: Boolean, default: false },
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

schema.virtual('size').get(function size() {
  return this.media.length;
});

module.exports = schema;
