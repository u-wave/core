'use strict';

/**
 * @param {import('../models').Playlist} model
 */
function serializePlaylist(model) {
  return {
    _id: model.id || model._id.toString(),
    name: model.name,
    author: model.author.toString(),
    createdAt: model.createdAt.toISOString(),
    description: model.description,
    size: model.media.length,
  };
}

/**
 * @param {Pick<import('../models').User,
 *   '_id' | 'username' | 'slug' | 'roles' | 'avatar' |
 *   'createdAt' | 'updatedAt' | 'lastSeenAt'>} model
 */
function serializeUser(model) {
  return {
    _id: model._id.toString(),
    username: model.username,
    slug: model.slug,
    roles: model.roles,
    avatar: model.avatar,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
    lastSeenAt: model.lastSeenAt.toISOString(),
  };
}

exports.serializePlaylist = serializePlaylist;
exports.serializeUser = serializeUser;
