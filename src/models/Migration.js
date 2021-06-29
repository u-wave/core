'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * @typedef {object} LeanMigration
 * @prop {import('mongodb').ObjectID} _id
 * @prop {string} migrationName
 * @prop {Date} createdAt
 * @prop {Date} updatedAt
 *
 * @typedef {import('mongoose').Document<LeanMigration["_id"]> & LeanMigration} Migration
 */

/**
 * @type {import('mongoose').Schema<Migration, import('mongoose').Model<Migration>>}
 */
const schema = new Schema({
  migrationName: { type: String, required: true },
}, {
  timestamps: true,
  collection: 'migrations',
});

module.exports = schema;
