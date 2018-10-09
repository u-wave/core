import { PassThrough } from 'stream';
import { URL } from 'url';
import pump from 'pump';
import isStream from 'is-stream';
import imageType from 'image-type';
import props from 'p-props';
import DefaultStore from 'fs-blob-store';
import PermissionError from '../errors/PermissionError';

function toImageStream(input) {
  const output = new PassThrough();
  input.pipe(output);

  return new Promise((resolve, reject) => {
    input.once('data', (chunk) => {
      const type = imageType(chunk);
      if (!type) {
        input.destroy();
        output.destroy();
        reject(new Error('toImageStream: Not an image.'));
      }
      if (type.mime !== 'image/png' && type.mime !== 'image/jpeg') {
        input.destroy();
        output.destroy();
        reject(new Error('toImageStream: Only PNG and JPEG are allowed.'));
      }

      Object.assign(output, type);
      resolve(output);
    });
  });
}

async function assertPermission(user, permission) {
  const allowed = await user.can(permission);
  if (!allowed) {
    throw new PermissionError(`User does not have the "${permission}" role.`);
  }
  return true;
}

const defaultOptions = {
  sigil: true,
  store: null,
};

class Avatars {
  constructor(uw, options) {
    this.uw = uw;
    this.options = { ...defaultOptions, ...options };

    this.store = this.options.store;
    if (typeof this.store === 'string') {
      this.store = new DefaultStore({
        path: this.store,
      });
    }

    if (typeof this.store === 'object' && this.store != null &&
        typeof this.options.publicPath !== 'string') {
      throw new TypeError('`publicPath` is not set, but it is required because `store` is set.');
    }

    this.magicAvatars = new Map();

    if (this.options.sigil) {
      this.addMagicAvatar(
        'sigil',
        user => `https://sigil.u-wave.net/${user.id}`,
      );
    }
  }

  /**
   * Define an avatar type, that can generate avatar URLs for
   * any user. eg. gravatar or an identicon service
   */
  addMagicAvatar(name, generator) {
    if (this.magicAvatars.has(name)) {
      throw new Error(`Magic avatar "${name}" already exists.`);
    }
    if (typeof name !== 'string') {
      throw new Error('Magic avatar name must be a string.');
    }
    if (typeof generator !== 'function') {
      throw new Error('Magic avatar generator must be a function.');
    }

    this.magicAvatars.set(name, generator);
  }

  /**
   * Get the available magic avatars for a user.
   */
  async getMagicAvatars(userID) {
    const { users } = this.uw;
    const user = await users.getUser(userID);

    const promises = new Map();
    this.magicAvatars.forEach((generator, name) => {
      promises.set(name, generator(user));
    });

    const avatars = await props(promises);

    return Array.from(avatars).map(([name, url]) => ({
      type: 'magic',
      name,
      url,
    })).filter(({ url }) => url != null);
  }

  async setMagicAvatar(userID, name) {
    const { users } = this.uw;

    if (!this.magicAvatars.has(name)) {
      throw new Error(`Magic avatar ${name} does not exist.`);
    }

    const user = await users.getUser(userID);
    const generator = this.magicAvatars.get(name);

    const url = await generator(user);

    await user.update({ avatar: url });
  }

  /**
   * Get the available social avatars for a user.
   */
  async getSocialAvatars(userID) {
    const { users } = this.uw;
    const { Authentication } = this.uw.models;
    const user = await users.getUser(userID);

    const socialAvatars = await Authentication
      .find({
        $comment: 'Find social avatars for a user.',
        user,
        type: { $ne: 'local' },
        avatar: { $exists: true, $ne: null },
      })
      .select({ type: true, avatar: true })
      .lean();

    return socialAvatars.map(({ type, avatar }) => ({
      type: 'social',
      service: type,
      url: avatar,
    }));
  }

  /**
   * Use the avatar from the given third party service.
   */
  async setSocialAvatar(userID, service) {
    const { users } = this.uw;
    const { Authentication } = this.uw.models;
    const user = await users.getUser(userID);

    const auth = await Authentication.findOne({ user, type: service });
    if (!auth || !auth.avatar) {
      throw new Error(`No avatar available for ${service}.`);
    }
    try {
      new URL(auth.avatar); // eslint-disable-line no-new
    } catch {
      throw new Error(`Invalid avatar URL for ${service}.`);
    }

    await user.setAvatar(auth.avatar);
  }

  /**
   * Check if custom avatar support is enabled.
   */
  supportsCustomAvatars() {
    return typeof this.options.publicPath === 'string'
      && typeof this.store === 'object';
  }

  /**
   * Use a custom avatar, read from a stream.
   */
  async setCustomAvatar(userID, stream) {
    const { users } = this.uw;

    if (!this.supportsCustomAvatars()) {
      throw new PermissionError('Custom avatars are not enabled.');
    }

    const user = await users.getUser(userID);
    await assertPermission(user, 'avatar.custom');

    if (!isStream(stream)) {
      throw new TypeError('Custom avatar must be a stream (eg. a http Request instance).');
    }

    const imageStream = await toImageStream(stream);
    const metadata = await new Promise((resolve, reject) => {
      const writeStream = this.store.createWriteStream({
        key: `${user.id}.${imageStream.type}`,
      }, (err, meta) => {
        if (err) reject(err);
        else resolve(meta);
      });
      pump(imageStream, writeStream);
    });

    const finalKey = metadata.key;
    const url = new URL(finalKey, this.options.publicPath);

    await user.setAvatar(url);
  }

  async getAvailableAvatars(userID) {
    const { users } = this.uw;
    const user = await users.getUser(userID);

    const all = await Promise.all([
      this.getMagicAvatars(user),
      this.getSocialAvatars(user),
    ]);

    // flatten
    return [].concat(...all);
  }

  async setAvatar(userID, avatar) {
    if (avatar.type === 'magic') {
      return this.setMagicAvatar(userID, avatar.name);
    }
    if (avatar.type === 'social') {
      return this.setSocialAvatar(userID, avatar.service);
    }
    throw new Error(`Unknown avatar type "${avatar.type}"`);
  }
}

export default function avatarsPlugin(options = {}) {
  return (uw) => {
    uw.avatars = new Avatars(uw, options); // eslint-disable-line no-param-reassign
  };
}
