import mongoose from 'mongoose';
import { createSchema } from 'mongoose-model-decorators';

const Types = mongoose.Schema.Types;

export default function playlistItemModel() {
  class PlaylistItem {
    static timestamps = true;

    static schema = {
      media: { type: Types.ObjectId, ref: 'Media', required: true },
      artist: { type: String, max: 128, required: true, index: true },
      title: { type: String, max: 128, required: true, index: true },
      start: { type: Number, min: 0, default: 0 },
      end: { type: Number, min: 0, default: 0 }
    };
  }

  const PlaylistItemSchema = createSchema({ minimize: false })(PlaylistItem);

  return uw =>
    uw.mongo.model('PlaylistItem', new PlaylistItemSchema());
}
