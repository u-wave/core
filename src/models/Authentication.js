'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

/**
 * @typedef {object} LeanAuthentication
 * @prop {import('mongodb').ObjectID} _id
 * @prop {import('mongodb').ObjectID} user
 * @prop {string} type
 * @prop {string} [email]
 * @prop {string} [hash]
 * @prop {string} [id]
 * @prop {string} [avatar]
 *
 * @typedef {import('mongoose').Document<LeanAuthentication["_id"]> & LeanAuthentication}
 *    Authentication
 */

/**
 * @type {import('mongoose').Schema<Authentication, import('mongoose').Model<Authentication>>}
 */
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
