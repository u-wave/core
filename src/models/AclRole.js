const mongoose = require('mongoose');

const { Schema } = mongoose;

async function aclRoleModel(uw) {
  const schema = new Schema({
    _id: String,
    roles: [{ type: String, ref: 'AclRole', index: true }],
  }, {
    collection: 'acl_roles',
    idKey: 'name',
    minimize: true,
  });

  uw.mongo.model('AclRole', schema);
}

module.exports = aclRoleModel;
