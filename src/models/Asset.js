'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

/**
 * @typedef {object} LeanAsset
 * @prop {import('mongodb').ObjectId} _id
 * @prop {string} name
 * @prop {string} path
 * @prop {string} category
 * @prop {import('mongodb').ObjectId} user
 * @prop {Date} createdAt
 * @prop {Date} updatedAt
 *
 * @typedef {mongoose.Document<LeanAsset["_id"], {}, LeanAsset> &
 *           LeanAsset} Asset
 */

/**
 * @type {mongoose.Schema<Asset, mongoose.Model<Asset>>}
 */
const schema = new Schema({
  name: { type: String, required: true },
  path: { type: String, required: true },
  category: { type: String, required: true },
  user: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
}, {
  collection: 'assets',
  timestamps: true,
  toJSON: { versionKey: false },
});

module.exports = schema;
