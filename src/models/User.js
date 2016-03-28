import { createSchema, pre } from 'mongoose-model-decorators';

export default uw => {
  class User {
    static schema = {
      joined: { type: Date, default: Date.now },
      username: { type: String, min: 3, max: 32, required: true, unique: true, index: true },
      language: { type: String, min: 2, max: 2, default: 'en' },
      role: { type: Number, min: 0, max: 5, default: 0, index: true },
      avatar: { type: String, min: 0, max: 256, default: '' },
      slug: { type: String, min: 3, max: 256, required: true },
      level: { type: Number, min: 0, max: 9001, default: 0 },
      lastSeen: { type: Date, default: Date.now },
      exiled: { type: Boolean, default: false },
      banned: { type: Date, default: null }
    };

    getActivePlaylistID(): Promise<string> {
      return uw.redis.get(`playlist:${this.id}`);
    }

    async getActivePlaylist(): Promise {
      const playlistID = await this.getActivePlaylistID();
      return await this.model('Playlist').findOne({ _id: playlistID });
    }

    @pre('validate')
    makeSlug() {
      this.slug = this.username.toLowerCase();
    }
  }

  return createSchema({ minimize: true })(User);
};
