'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

const schema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', index: true },
  type: { type: String, required: true, default: 'local' },
  // Local login
  email: {
    type: String, max: 254, unique: true, index: true,
  },
  hash: { type: String },
  // Social login
  id: { type: String },
  avatar: { type: String, required: false },
}, {
  timestamps: true,
  minimize: false,
});

module.exports = schema;
