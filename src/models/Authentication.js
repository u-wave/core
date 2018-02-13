import mongoose from 'mongoose';

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

export default function authenticationModel() {
  const schema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', index: true },
    type: { type: String, required: true, default: 'local' },
    // Local login
    email: {
      type: String, max: 254, unique: true, index: true,
    },
    hash: { type: String },
    // Social login
    id: { type: String },
  }, {
    timestamps: true,
    minimize: false,
  });

  return (uw) => {
    uw.mongo.model('Authentication', schema);
  };
}
