'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * @typedef {object} LeanMigration
 * @prop {import('mongodb').ObjectId} _id
 * @prop {string} migrationName
 * @prop {Date} createdAt
 * @prop {Date} updatedAt
 *
 * @typedef {mongoose.Document<LeanMigration["_id"], {}, LeanMigration> & LeanMigration} Migration
 */

/**
 * @type {mongoose.Schema<Migration, mongoose.Model<Migration>>}
 */
const schema = new Schema({
  migrationName: { type: String, required: true },
}, {
  timestamps: true,
  collection: 'migrations',
});

module.exports = schema;
