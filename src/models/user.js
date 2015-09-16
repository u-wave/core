import mongoose from 'mongoose';
import {escaper, validator} from '../plugins/escaper';
const Schema = mongoose.Schema;

const userSchema = new Schema({
  'joined': { 'type': Date, 'default': Date.now },
  'username': { 'type': String, 'min': 3, 'max': 32, 'required': true, 'escape': true, 'validate': validator, 'unique': true },
  'language': { 'type': String, 'min': 2, 'max': 2, 'default': 'en' },
  'role': { 'type': Number, 'min': 0, 'max': 5, 'default': 0 },
  'avatar': { 'type': String, 'min': 0, 'max': 256, 'default': '' },
  'slug': { 'type': String, 'min': 3, 'max': 256, 'escape': true, 'validate': validator, 'required': true },
  'level': { 'type': Number, 'min': 0, 'max': 9001, 'default': 0 },
  'lastSeen': { 'type': Date, 'default': Date.now },
  'exiled': { 'type': Boolean, 'default': false },
  'banned': { 'type': Date, 'default': null }
}, {
  'minimize': false
});

userSchema.pre('validate', function _assignSlug(next) {
  this.slug = this.username.toLowerCase();
  next();
});

userSchema.plugin(escaper);
export default mongoose.model('User', userSchema);
