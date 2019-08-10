// eslint-disable-next-line import/prefer-default-export
export const serializePlaylist = model => ({
  _id: model.id,
  name: model.name,
  author: model.author,
  createdAt: model.createdAt,
  description: model.description,
  shared: model.shared,
  nsfw: model.nsfw,
  size: model.media.length,
});
