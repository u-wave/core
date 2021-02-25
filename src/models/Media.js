'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * @typedef {object} LeanMedia
 * @prop {import('mongodb').ObjectID} _id
 * @prop {string} sourceID
 * @prop {string} sourceType
 * @prop {object} sourceData
 * @prop {string} artist
 * @prop {string} title
 * @prop {number} duration
 * @prop {string} thumbnail
 * @prop {Date} createdAt
 * @prop {Date} updatedAt
 *
 * @typedef {import('mongoose').Document<LeanMedia["_id"]> & LeanMedia} Media
 */

const schema = new Schema({
  sourceID: {
    type: String, max: 128, required: true, index: true,
  },
  sourceType: {
    type: String, max: 128, required: true, index: true,
  },
  sourceData: {},
  artist: {
    type: String,
    max: 128,
    required: true,
    set: (artist) => artist.normalize('NFKC'),
  },
  title: {
    type: String,
    max: 128,
    required: true,
    set: (title) => title.normalize('NFKC'),
  },
  duration: { type: Number, min: 0, default: 0 },
  thumbnail: { type: String, max: 256, default: '' },
}, {
  timestamps: true,
  minimize: false,
});

module.exports = schema;
