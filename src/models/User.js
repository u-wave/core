const mongoose = require('mongoose');
const { slugify } = require('transliteration');

/**
 * @template Element
 * @template Pagination
 * @typedef {import('../Page')<Element, Pagination>} Page
 */

const { Schema } = mongoose;
const { Types } = mongoose.Schema;

function userModel() {
  return (uw) => {
    const bannedSchema = new Schema({
      moderator: { type: Types.ObjectId, ref: 'User', index: true },
      duration: { type: Number, required: true },
      expiresAt: { type: Date, required: true, index: true },
      reason: { type: String, default: '' },
    });

    const userSchema = new Schema({
      username: {
        type: String,
        minlength: [3, 'Usernames have to be at least 3 characters long.'],
        maxlength: [32, 'Usernames can be at most 32 characters long.'],
        match: [/^[^\s]+$/, 'Usernames can\'t contain spaces.'],
        required: true,
        unique: true,
        index: true,
        set: (name) => name.normalize('NFKC'),
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
      banned: bannedSchema,
      pendingActivation: { type: String, required: false },
    }, {
      timestamps: true,
      minimize: false,
    });

    userSchema.pre('validate', function preValidate(next) {
      this.slug = slugify(this.username);
      next();
    });

    userSchema.loadClass(class User {
      /**
       * @return {Promise<string[]>}
       */
      getPermissions() {
        return uw.acl.getAllPermissions(this);
      }

      /**
       * @param {string} permission
       * @return {Promise<boolean>}
       */
      can(permission) {
        return uw.acl.isAllowed(this, permission);
      }

      /**
       * @param {string[]} permissions
       * @return {Promise<unknown>}
       */
      allow(permissions) {
        return uw.acl.allow(this, permissions);
      }

      /**
       * @param {string[]} permissions
       * @return {Promise<unknown>}
       */
      disallow(permissions) {
        return uw.acl.disallow(this, permissions);
      }

      /**
       * @param {string} password
       * @return {Promise<unknown>}
       */
      updatePassword(password) {
        return uw.users.updatePassword(this, password);
      }

      /**
       * @return {Promise<unknown[]>}
       */
      getPlaylists() {
        return uw.playlists.getUserPlaylists(this);
      }

      /**
       * @return {Promise<unknown>}
       */
      getPlaylist(id) {
        return uw.playlists.getUserPlaylist(this, id);
      }

      /**
       * @return {Promise<string>}
       */
      getActivePlaylistID() {
        return uw.redis.get(`playlist:${this.id}`);
      }

      /**
       * @return {Promise<unknown>}
       */
      async getActivePlaylist() {
        const playlistID = await this.getActivePlaylistID();
        return uw.playlists.getPlaylist(playlistID);
      }

      /**
       * @return {Promise<unknown>}
       */
      async setActivePlaylist(id) {
        const playlist = await this.getPlaylist(id);
        await uw.redis.set(`playlist:${this.id}`, playlist.id);
        return this;
      }

      /**
       * @return {Promise<unknown>}
       */
      createPlaylist(props) {
        return uw.playlists.createPlaylist(this, props);
      }

      /**
       * @return {Promise<Page<unknown, unknown>>}
       */
      getHistory(pagination = {}) {
        return uw.history.getUserHistory(this, pagination);
      }

      /**
       * @return {Promise<unknown>}
       */
      async mute(...args) {
        return uw.chat.mute(this, ...args);
      }

      /**
       * @return {Promise<unknown>}
       */
      async unmute(...args) {
        return uw.chat.unmute(this, ...args);
      }

      /**
       * @return {Promise<boolean>}
       */
      async isMuted() {
        return uw.chat.isMuted(this);
      }

      /**
       * @return {Promise<boolean>}
       */
      isBanned() {
        return uw.bans.isBanned(this);
      }
    });

    uw.mongo.model('User', userSchema);
  };
}

module.exports = userModel;
