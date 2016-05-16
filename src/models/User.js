import mongoose from 'mongoose';
import { createSchema, pre } from 'mongoose-model-decorators';
import slugify from 'speakingurl';

const Types = mongoose.Schema.Types;

export default uw => {
  class Banned {
    static schema = {
      moderator: { type: Types.ObjectId, ref: 'User', index: true },
      duration: { type: Number, required: true },
      expiresAt: { type: Date, required: true, index: true },
      reason: { type: String, default: '' }
    };
  }

  const BannedSchema = createSchema(Banned);

  class User {
    static timestamps = true;

    static schema = {
      username: {
        type: String,
        minlength: [3, 'Usernames have to be at least 3 characters long.'],
        maxlength: [32, 'Usernames can be at most 32 characters long.'],
        match: [/^[^\s]+$/, 'Usernames can\'t contain spaces.'],
        required: true,
        unique: true,
        index: true
      },
      language: { type: String, min: 2, max: 2, default: 'en' },
      role: { type: Number, min: 0, max: 5, default: 0, index: true },
      avatar: { type: String, min: 0, max: 256, default: '' },
      slug: {
        type: String,
        unique: true,
        required: true,
        index: true
      },
      level: { type: Number, min: 0, max: 9001, default: 0 },
      lastSeenAt: { type: Date, default: Date.now },
      exiled: { type: Boolean, default: false },
      banned: new BannedSchema()
    };

    @pre('validate')
    makeSlug() {
      this.slug = slugify(this.username, { lang: this.language });
    }

    getPlaylists(): Promise<Array> {
      return uw.playlists.getUserPlaylists(this);
    }

    getPlaylist(id): Promise {
      return uw.playlists.getUserPlaylist(this, id);
    }

    getActivePlaylistID(): Promise<string> {
      return uw.redis.get(`playlist:${this.id}`);
    }

    async getActivePlaylist(): Promise {
      const playlistID = await this.getActivePlaylistID();
      return await uw.playlists.getPlaylist(playlistID);
    }

    async setActivePlaylist(id): Promise {
      const playlist = await this.getPlaylist(id);
      await uw.redis.set(`playlist:${this.id}`, playlist.id);
      return this;
    }

    createPlaylist(props): Promise {
      return uw.playlists.createPlaylist(this, props);
    }

    async mute(...args): Promise {
      return await uw.chat.mute(this, ...args);
    }
    async unmute(...args): Promise {
      return await uw.chat.unmute(this, ...args);
    }

    async isMuted(): Promise<boolean> {
      return await uw.chat.isMuted(this);
    }
  }

  return createSchema({ minimize: true })(User);
};
