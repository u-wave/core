import { createSchema } from 'mongoose-model-decorators';

export default function mediaModel() {
  class Media {
    static timestamps = true;

    static schema = {
      sourceID: {
        type: String, max: 128, required: true, index: true
      },
      sourceType: {
        type: String, max: 128, required: true, index: true
      },
      sourceData: {},
      artist: { type: String, max: 128, required: true },
      title: { type: String, max: 128, required: true },
      duration: { type: Number, min: 0, default: 0 },
      thumbnail: { type: String, max: 256, default: '' }
    };
  }

  const MediaSchema = createSchema({ minimize: false })(Media);

  return uw =>
    uw.mongo.model('Media', new MediaSchema());
}
