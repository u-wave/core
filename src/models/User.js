'use strict';

const mongoose = require('mongoose');
const { slugify } = require('transliteration');

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

/**
 * @typedef {object} LeanBanned
 * @prop {import('mongoose').Types.ObjectId} _id
 * @prop {import('mongoose').Types.ObjectId} moderator
 * @prop {number} duration
 * @prop {Date} expiresAt
 * @prop {string} reason
 *
 * @typedef {import('mongoose').Document<LeanBanned>} Banned
 */

/**
 * @typedef {object} LeanUser
 * @prop {import('mongoose').Types.ObjectId} _id
 * @prop {string} username
 * @prop {string} language
 * @prop {string[]} roles
 * @prop {string} avatar
 * @prop {string} slug
 * @prop {import('mongoose').Types.ObjectId|null} activePlaylist
 * @prop {Date} lastSeenAt
 * @prop {Banned|undefined} banned
 * @prop {string|undefined} pendingActivation
 * @prop {Date} createdAt
 * @prop {Date} updatedAt
 *
 * @typedef {import('mongoose').Document<LeanUser>} User
 */

const bannedSchema = new Schema({
  moderator: { type: Types.ObjectId, ref: 'User', index: true },
  duration: { type: Number, required: true },
  expiresAt: { type: Date, required: true, index: true },
  reason: { type: String, default: '' },
});

const userSchema = new Schema({
  username: {
    type: String,
    minlength: [3, 'Usernames have to be at least 3 characters long.'],
    maxlength: [32, 'Usernames can be at most 32 characters long.'],
    match: [/^[^\s]+$/, 'Usernames can\'t contain spaces.'],
    required: true,
    unique: true,
    index: true,
    set: (name) => name.normalize('NFKC'),
  },
  language: {
    type: String, min: 2, max: 2, default: 'en',
  },
  roles: [{ type: String, ref: 'AclRole' }],
  // Deprecated, `roles` should be used instead.
  // However some clients (*cough* u-wave-web *cough*) haven't updated to the
  // ACL system so they need this key to exist.
  role: { type: Number, min: 0, default: 0 },
  avatar: {
    type: String, min: 0, max: 256, default: '',
  },
  slug: {
    type: String,
    unique: true,
    required: [true, 'Usernames must not consist of punctuation only.'],
    index: true,
  },
  activePlaylist: {
    type: Types.ObjectId,
    ref: 'Playlist',
  },
  level: {
    type: Number, min: 0, max: 9001, default: 0,
  },
  lastSeenAt: { type: Date, default: Date.now },
  exiled: { type: Boolean, default: false },
  banned: bannedSchema,
  pendingActivation: { type: String, required: false },
}, {
  timestamps: true,
  minimize: false,
});

userSchema.pre('validate', /** @this {User} */ function preValidate(next) {
  this.slug = slugify(this.username);
  next();
});

module.exports = userSchema;
