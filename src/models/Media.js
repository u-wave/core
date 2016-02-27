import { createSchema } from 'mongoose-model-decorators';

export default () => {
  class Media {
    static schema = {
      artist: { type: String, max: 128, required: true },
      title: { type: String, max: 128, required: true },
      duration: { type: Number, min: 0, default: 0 },
      thumbnail: { type: String, max: 256, default: '' },
      sourceID: { type: String, max: 128, required: true },
      sourceType: { type: String, max: 128, required: true },
      nsfw: { type: Boolean, default: false },
      restricted: [{ type: String, max: 2 }]
    };
  }

  return createSchema({ minimize: false })(Media);
};
