import mongoose from 'mongoose';

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

const listOfUsers = [{ type: Types.ObjectId, ref: 'User' }];

/**
 * @typedef {import('type-fest').JsonObject} HistorySourceData
 */

/**
 * @typedef {object} HistoryMedia
 * @prop {import('mongodb').ObjectId} media
 *     Reference to the `Media` object that is being played.
 * @prop {string} artist
 *     Snapshot of the media artist name at the time this entry was played.
 * @prop {string} title
 *     Snapshot of the media title at the time this entry was played.
 * @prop {number} start
 *     Time to start playback at.
 * @prop {number} end
 *     Time to stop playback at.
 * @prop {HistorySourceData} sourceData
 *     Arbitrary source-specific data required for media playback.
 */

/**
 * @typedef {object} LeanHistoryEntry
 * @prop {import('mongodb').ObjectId} _id
 * @prop {import('mongodb').ObjectId} user
 * @prop {import('mongodb').ObjectId} playlist
 * @prop {import('mongodb').ObjectId} item
 * @prop {mongoose.Document<never, {}, HistoryMedia> & HistoryMedia} media
 * @prop {Date} playedAt
 * @prop {import('mongodb').ObjectId[]} upvotes
 * @prop {import('mongodb').ObjectId[]} downvotes
 * @prop {import('mongodb').ObjectId[]} favorites
 */

/**
 * @typedef {mongoose.Document<LeanHistoryEntry["_id"], {}, LeanHistoryEntry> &
 *           LeanHistoryEntry} HistoryEntry
 */

/**
 * @type {mongoose.Schema<HistoryEntry, mongoose.Model<HistoryEntry>>}
 */
const schema = new Schema({
  user: {
    type: Types.ObjectId, ref: 'User', required: true, index: true,
  },
  playlist: { type: Types.ObjectId, ref: 'Playlist' },
  item: { type: Types.ObjectId, ref: 'PlaylistItem' },
  media: {
    media: { type: Types.ObjectId, ref: 'Media', required: true },
    artist: {
      type: String,
      index: true,
      /** @type {(name: string) => string} */
      set: (artist) => artist.normalize('NFKC'),
    },
    title: {
      type: String,
      index: true,
      /** @type {(name: string) => string} */
      set: (title) => title.normalize('NFKC'),
    },
    start: { type: Number, default: 0 },
    end: { type: Number, default: 0 },
    // Bypass typecheck as JsonObject is a recursive structure & causes infinite looping here.
    /** @type {any} */
    sourceData: { type: Object, select: false },
  },
  playedAt: { type: Date, default: () => new Date(), index: true },
  upvotes: listOfUsers,
  downvotes: listOfUsers,
  favorites: listOfUsers,
}, {
  collection: 'historyentries',
  minimize: false,
});

export default schema;
