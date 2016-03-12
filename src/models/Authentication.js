import mongoose from 'mongoose';
import { createSchema } from 'mongoose-model-decorators';

const Types = mongoose.Schema.Types;

export default () => {
  class Authentication {
    static schema = {
      user: { type: Types.ObjectId, ref: 'User' },
      email: { type: String, max: 254, required: true, unique: true },
      hash: { type: String, required: true },
      validated: { type: Boolean, default: false }
    };
  }

  return createSchema({ minimize: false })(Authentication);
};
