import mongoose from 'mongoose';
import { createSchema } from 'mongoose-model-decorators';

export default uw => {
  class AclRole {
    static collection = 'acl_roles';
    static idKey = 'name';

    static schema = {
      _id: String,
      roles: [{ type: String, ref: 'AclRole', index: true }]
    };
  }

  return createSchema({ minimize: true })(AclRole);
};
