import mongoose from 'mongoose';

const { Schema } = mongoose;

export default function mediaModel() {
  const schema = new Schema({
    sourceID: {
      type: String, max: 128, required: true, index: true,
    },
    sourceType: {
      type: String, max: 128, required: true, index: true,
    },
    sourceData: {},
    artist: { type: String, max: 128, required: true },
    title: { type: String, max: 128, required: true },
    duration: { type: Number, min: 0, default: 0 },
    thumbnail: { type: String, max: 256, default: '' },
  }, {
    timestamps: true,
    minimize: false,
  });

  return (uw) => {
    uw.mongo.model('Media', schema);
  };
}
