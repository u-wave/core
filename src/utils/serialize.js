'use strict';

/**
 * @param {import('../models').Playlist} model
 */
function serializePlaylist(model) {
  return {
    _id: model.id || model._id.toString(),
    name: model.name,
    author: model.author,
    createdAt: model.createdAt,
    description: model.description,
    size: model.media.length,
  };
}

/**
 * @param {import('../models').User} model
 */
function serializeUser(model) {
  return {
    _id: model._id.toString(),
    username: model.username,
    slug: model.slug,
    roles: model.roles,
    avatar: model.avatar,
    createdAt: model.createdAt.toString(),
    updatedAt: model.updatedAt.toString(),
    lastSeenAt: model.lastSeenAt.toString(),
  };
}

exports.serializePlaylist = serializePlaylist;
exports.serializeUser = serializeUser;
