import mongoose from 'mongoose';
import { createSchema } from 'mongoose-model-decorators';

const Types = mongoose.Schema.Types;

export default () => {
  class Authentication {
    static schema = {
      user: { type: Types.ObjectId, ref: 'User', index: true },
      email: { type: String, max: 254, required: true, unique: true, index: true },
      hash: { type: String, required: true },
      salt: { type: String, required: true },
      validated: { type: Boolean, default: false }
    };
  }

  return createSchema({ minimize: false })(Authentication);
};
