'use strict';

function serializePlaylist(model) {
  return {
    _id: model.id,
    name: model.name,
    author: model.author,
    createdAt: model.createdAt,
    description: model.description,
    size: model.media.length,
  };
}

exports.serializePlaylist = serializePlaylist;
