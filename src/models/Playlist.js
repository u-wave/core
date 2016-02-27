import mongoose from 'mongoose';
import { createSchema } from 'mongoose-model-decorators';

const Types = mongoose.Schema.Types;

export default () => {
  class Playlist {
    static schema = {
      created: { type: Date, default: Date.now },
      name: { type: String, min: 0, max: 128, required: true },
      description: { type: String, min: 0, max: 512 },
      author: { type: Types.ObjectId, ref: 'User', required: true },
      shared: { type: Boolean, default: false },
      nsfw: { type: Boolean, default: false },
      media: [{ type: Types.ObjectId, ref: 'PlaylistItem' }]
    };

    get size(): number {
      return this.media.length;
    }

    getItemAt(index): Promise {
      return this.model('PlaylistItem').findOne(this.media[index]);
    }
  }

  return createSchema({ minimize: false })(Playlist);
};
