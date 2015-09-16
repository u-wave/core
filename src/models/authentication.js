import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const authenticationSchema = new Schema({
  'user': { 'type': Schema.Types.ObjectId, 'ref': 'User' },
  'email': { 'type': String, 'max': 128, 'required': true, 'unique': true },
  'hash': { 'type': String, 'required': true },
  'salt': { 'type': String, 'required': true },
  'validated': { 'type': Boolean, 'default': false }
});

export default mongoose.model('Authentication', authenticationSchema);
