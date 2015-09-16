import mongoose from 'mongoose';
import {escaper, validator} from '../plugins/escaper';
const Schema = mongoose.Schema;

const playlistSchema = new Schema({
  'created': { 'type': Date, 'default': Date.now },
  'name': { 'type': String, 'min': 0, 'max': 128, 'escape': true, 'validate': validator, 'required': true },
  'description': { 'type': String, 'min': 0, 'max': 512, 'escape': true, 'validate': validator, 'required': true },
  'authorID': { 'type': Schema.Types.ObjectId, 'required': true },
  'private': { 'type': Boolean, 'default': true },
  'nsfw': { 'type': Boolean, 'default': false },
  'media': [Number]
});

playlistSchema.plugin(escaper);
export default mongoose.model('Playlist', playlistSchema);
