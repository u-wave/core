'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * @typedef {object} LeanAclRole
 * @prop {string} _id
 * @prop {string[]} roles
 *
 * @typedef {import('mongoose').Document<LeanAclRole["_id"]> & LeanAclRole} AclRole
 */

const schema = new Schema({
  _id: String,
  roles: [{ type: String, ref: 'AclRole', index: true }],
}, {
  collection: 'acl_roles',
  minimize: true,
});

module.exports = schema;
