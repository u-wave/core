import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const historySchema = new Schema({
  'user': { 'type': Schema.Types.ObjectId, 'ref': 'User', 'required': true },
  'media': { 'type': Schema.Types.ObjectId, 'ref': 'Media', 'required': true },
  'playlist': { 'type': Schema.Types.ObjectId, 'ref': 'Playlist', 'required': true },
  'played': { 'type': Date, 'default': Date.now, 'required': true },
  'upvotes': [Number],
  'downvotes': [Number],
  'favorites': [Number]
});

export default mongoose.model('History', historySchema);
