import mongoose from 'mongoose';
import {escaper, validator} from '../plugins/escaper';
const Schema = mongoose.Schema;

// TODO: probably should allow to embed links
const roomSchema = new Schema({
  'created': { 'type': Date, 'default': Date.now },
  'name': { 'type': String, 'max': 128, 'escape': true, 'validate': validator, 'required': true },
  'description': { 'type': String, 'max': 512, 'escape': true, 'validate': validator },
  'motd': { 'type': String, 'max': 128, 'escape': true, 'validate': validator },
  'genre': { 'type': String, 'max': 128 },
  'host': { 'type': Schema.Types.ObjectId, 'ref': 'User' },
  'media': { 'type': Schema.Types.ObjectId, 'ref': 'Media' }
});

roomSchema.plugin(escaper);
export default mongoose.model('Room', roomSchema);
