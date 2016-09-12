import mongoose from 'mongoose';
import { createSchema } from 'mongoose-model-decorators';

const Types = mongoose.Schema.Types;

export default function authenticationModel() {
  class Authentication {
    static timestamps = true;

    static schema = {
      user: { type: Types.ObjectId, ref: 'User', index: true },
      email: { type: String, max: 254, required: true, unique: true, index: true },
      hash: { type: String, required: true },
      validated: { type: Boolean, default: false }
    };
  }

  const AuthSchema = createSchema({ minimize: false })(Authentication);

  return uw =>
    uw.mongo.model('Authentication', new AuthSchema());
}
