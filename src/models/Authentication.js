import mongoose from 'mongoose';
import { createSchema } from 'mongoose-model-decorators';

const { Types } = mongoose.Schema;

export default function authenticationModel() {
  class Authentication {
    static timestamps = true;

    static schema = {
      user: { type: Types.ObjectId, ref: 'User', index: true },
      type: { type: String, required: true, default: 'local' },
      // Local login
      email: {
        type: String, max: 254, unique: true, index: true,
      },
      hash: { type: String },
      // Social login
      id: { type: String },
    };
  }

  const AuthSchema = createSchema({ minimize: false })(Authentication);

  return uw =>
    uw.mongo.model('Authentication', new AuthSchema());
}
