import { createSchema } from 'mongoose-model-decorators';

export default () => {
  class Media {
    static schema = {
      sourceID: { type: String, max: 128, required: true },
      sourceType: { type: String, max: 128, required: true },
      sourceData: {},
      artist: { type: String, max: 128, required: true },
      title: { type: String, max: 128, required: true },
      duration: { type: Number, min: 0, default: 0 },
      thumbnail: { type: String, max: 256, default: '' }
    };
  }

  return createSchema({ minimize: false })(Media);
};
