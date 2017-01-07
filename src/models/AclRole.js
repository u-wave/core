import { createSchema } from 'mongoose-model-decorators';

export default function aclRoleModel() {
  class AclRole {
    static collection = 'acl_roles';
    static idKey = 'name';

    static schema = {
      _id: String,
      roles: [{ type: String, ref: 'AclRole', index: true }]
    };
  }

  const AclRoleSchema = createSchema({ minimize: true })(AclRole);
  return uw =>
    uw.mongo.model('AclRole', new AclRoleSchema());
}
