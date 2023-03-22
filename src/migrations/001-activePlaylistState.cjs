/**
 * Moves the active playlist state from Redis into MongoDB.
 *
 * See https://github.com/u-wave/core/issues/401.
 */

'use strict';

const { ObjectId } = require('mongoose').mongo;
const { zip } = require('lodash');

const rxObjectID = /^[0-9a-f]{24}$/;

// Cannot use `@type {import('umzug').MigrationFn<import('../Uwave')>}`
// due to https://github.com/microsoft/TypeScript/issues/43160

/**
 * @param {import('umzug').MigrationParams<import('../Uwave')>} params
 */
async function up({ context: uw }) {
  const { User } = uw.models;

  const ops = [];
  for await (const keys of uw.redis.scanStream({ match: 'playlist:*' })) {
    if (keys.length === 0) {
      continue;
    }

    const values = await uw.redis.mget(keys);
    for (const [key, playlistID] of zip(keys, values)) {
      const userID = key.replace(/^playlist:/, '');
      if (!playlistID || !rxObjectID.test(userID) || !rxObjectID.test(playlistID)) {
        // must be corrupt if it isn't an object ID.
        continue;
      }

      ops.push({
        updateOne: {
          filter: { _id: new ObjectId(userID) },
          update: {
            $set: { activePlaylist: new ObjectId(playlistID) },
          },
        },
      });
    }
    await uw.redis.unlink(keys);
  }

  await User.bulkWrite(ops);
}

/**
 * @param {import('umzug').MigrationParams<import('../Uwave')>} params
 */
async function down({ context: uw }) {
  const { User } = uw.models;

  const users = User.find({ activePlaylist: { $ne: null } });

  for await (const user of users) {
    if (!user.activePlaylist) return;

    await uw.redis.set(`playlist:${user._id}`, user.activePlaylist.toString());
  }
}

module.exports = { up, down };
