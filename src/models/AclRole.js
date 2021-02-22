'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const schema = new Schema({
  _id: String,
  roles: [{ type: String, ref: 'AclRole', index: true }],
}, {
  collection: 'acl_roles',
  idKey: 'name',
  minimize: true,
});

module.exports = schema;
