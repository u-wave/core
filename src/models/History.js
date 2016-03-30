import mongoose from 'mongoose';
import { createSchema } from 'mongoose-model-decorators';

const Types = mongoose.Schema.Types;

const listOfUsers = [{ type: Types.ObjectId, ref: 'User' }];

export default () => {
  class History {
    static collection = 'historyentries';

    static schema = {
      user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
      playlist: { type: Types.ObjectId, ref: 'Playlist' },
      item: { type: Types.ObjectId, ref: 'PlaylistItem' },
      media: {
        media: { type: Types.ObjectId, ref: 'Media', required: true },
        artist: { type: String, index: true },
        title: { type: String, index: true },
        start: { type: Number, default: 0 },
        end: { type: Number, default: 0 }
      },
      playedAt: { type: Date, default: Date.now, index: true },
      upvotes: listOfUsers,
      downvotes: listOfUsers,
      favorites: listOfUsers
    };
  }

  return createSchema({ minimize: false })(History);
};
