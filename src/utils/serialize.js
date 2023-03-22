/**
 * @param {import('../models').Playlist | import('../models/Playlist').LeanPlaylist} model
 */
export function serializePlaylist(model) {
  return {
    _id: 'id' in model ? model.id : model._id.toString(),
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
export function serializeUser(model) {
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
