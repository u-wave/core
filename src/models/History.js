import mongoose from 'mongoose';
import { createSchema } from 'mongoose-model-decorators';

const Types = mongoose.Schema.Types;

const listOfUsers = [{ type: Types.ObjectId, ref: 'User' }];

export default () => {
  class History {
    static collection = 'historyentries';

    static schema = {
      user: { type: Types.ObjectId, ref: 'User', required: true },
      playlist: { type: Types.ObjectId, ref: 'Playlist' },
      item: { type: Types.ObjectId, ref: 'PlaylistItem' },
      media: {
        media: { type: Types.ObjectId, ref: 'Media', required: true },
        artist: String,
        title: String,
        start: { type: Number, default: 0 },
        end: { type: Number, default: 0 }
      },
      played: { type: Date, default: Date.now },
      upvotes: listOfUsers,
      downvotes: listOfUsers,
      favorites: listOfUsers
    };
  }

  return createSchema({ minimize: false })(History);
};
