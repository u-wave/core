import mongoose from 'mongoose';
import { createSchema } from 'mongoose-model-decorators';
import { slugify } from 'transliteration';

import Page from '../Page';

const { Types } = mongoose.Schema;

export default function userModel() {
  return (uw) => {
    class Banned {
      static schema = {
        moderator: { type: Types.ObjectId, ref: 'User', index: true },
        duration: { type: Number, required: true },
        expiresAt: { type: Date, required: true, index: true },
        reason: { type: String, default: '' },
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
          index: true,
        },
        language: {
          type: String, min: 2, max: 2, default: 'en',
        },
        roles: [{ type: String, ref: 'AclRole' }],
        // Deprecated, `roles` should be used instead.
        // However some clients (*cough* u-wave-web *cough*) haven't updated to the
        // ACL system so they need this key to exist.
        role: { type: Number, min: 0, default: 0 },
        avatar: {
          type: String, min: 0, max: 256, default: '',
        },
        slug: {
          type: String,
          unique: true,
          required: [true, 'Usernames must not consist of punctuation only.'],
          index: true,
        },
        level: {
          type: Number, min: 0, max: 9001, default: 0,
        },
        lastSeenAt: { type: Date, default: Date.now },
        exiled: { type: Boolean, default: false },
        banned: new BannedSchema(),
      };

      makeSlug() {
        this.slug = slugify(this.username);
      }

      getPermissions(): Promise<Array<string>> {
        return uw.acl.getAllPermissions(this);
      }

      can(permission: string): Promise<boolean> {
        return uw.acl.isAllowed(this, permission);
      }

      allow(permissions: Array<string>): Promise {
        return uw.acl.allow(this, permissions);
      }

      disallow(permissions: Array<string>): Promise {
        return uw.acl.disallow(this, permissions);
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
        return uw.playlists.getPlaylist(playlistID);
      }

      async setActivePlaylist(id): Promise {
        const playlist = await this.getPlaylist(id);
        await uw.redis.set(`playlist:${this.id}`, playlist.id);
        return this;
      }

      createPlaylist(props): Promise {
        return uw.playlists.createPlaylist(this, props);
      }

      getHistory(pagination = {}): Promise<Page> {
        return uw.history.getUserHistory(this, pagination);
      }

      async mute(...args): Promise {
        return uw.chat.mute(this, ...args);
      }
      async unmute(...args): Promise {
        return uw.chat.unmute(this, ...args);
      }

      async isMuted(): Promise<boolean> {
        return uw.chat.isMuted(this);
      }

      isBanned(): Promise<boolean> {
        return uw.bans.isBanned(this);
      }

      async seen(): Promise {
        this.lastSeenAt = Date.now();
        await this.save();
      }
    }

    const UserSchema = createSchema({ minimize: true })(User);
    const schema = new UserSchema();
    schema.pre('validate', function preValidate(next) {
      this.makeSlug();
      next();
    });

    return uw.mongo.model('User', schema);
  };
}
