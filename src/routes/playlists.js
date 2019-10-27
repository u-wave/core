import router from 'router';
import route from '../route';
import * as validations from '../validations';
import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/playlists';

export default function playlistRoutes() {
  return router()
    .use(protect())

    // GET /playlists/ - List playlists.
    .get(
      '/',
      checkFields(validations.getPlaylists),
      route(controller.getPlaylists),
    )
    // POST /playlists/ - Create a new playlist.
    .post(
      '/',
      checkFields(validations.createPlaylist),
      route(controller.createPlaylist),
    )

    // GET /playlists/:id - Get a single playlist's metadata (not items!).
    .get(
      '/:id',
      checkFields(validations.getPlaylist),
      route(controller.getPlaylist),
    )
    // DELETE /playlists/:id - Delete a playlist.
    .delete(
      '/:id',
      checkFields(validations.deletePlaylist),
      route(controller.deletePlaylist),
    )
    // PATCH /playlists/:id - Change playlist metadata, such as the name.
    .patch(
      '/:id',
      checkFields(validations.updatePlaylist),
      route(controller.updatePlaylist),
    )
    // PUT /playlists/:id/rename - Rename a playlist.
    // TODO call this /playlists/:id/name
    .put(
      '/:id/rename',
      checkFields(validations.renamePlaylist),
      route(controller.renamePlaylist),
    )
    // PUT /playlists/:id/share - Publicise or privatise a playlist.
    .put(
      '/:id/share',
      checkFields(validations.sharePlaylist),
      route(controller.sharePlaylist),
    )
    // PUT /playlists/:id/activate - Set the playlist as active.
    .put(
      '/:id/activate',
      route(controller.activatePlaylist),
    )
    // GET /playlists/:id/media - Get playlist items.
    .get(
      '/:id/media',
      checkFields(validations.getPlaylistItems),
      route(controller.getPlaylistItems),
    )
    // POST /playlists/:id/media - Add items to a playlist.
    .post(
      '/:id/media',
      checkFields(validations.addPlaylistItems),
      route(controller.addPlaylistItems),
    )
    // DELETE /playlists/:id/media - Delete items from a playlist.
    .delete(
      '/:id/media',
      checkFields(validations.removePlaylistItems),
      route(controller.removePlaylistItems),
    )
    // PUT /playlists/:id/move - Move playlist items.
    // TODO This should probably not be a PUT
    .put(
      '/:id/move',
      checkFields(validations.movePlaylistItems),
      route(controller.movePlaylistItems),
    )
    // POST /playlists/:id/shuffle - Shuffle a playlist's items.
    .post(
      '/:id/shuffle',
      checkFields(validations.shufflePlaylistItems),
      route(controller.shufflePlaylistItems),
    )
    // GET /playlists/:id/media/:itemID - Get a single playlist item.
    .get(
      '/:id/media/:itemID',
      checkFields(validations.getPlaylistItem),
      route(controller.getPlaylistItem),
    )
    // PUT /playlists/:id/media/:itemID - Change metadata for a playlist item.
    // TODO This should probably be a PATCH instead
    .put(
      '/:id/media/:itemID',
      checkFields(validations.updatePlaylistItem),
      route(controller.updatePlaylistItem),
    )
    // DELETE /playlists/:id/media/:itemID - Remove an item from the playlist.
    .delete(
      '/:id/media/:itemID',
      checkFields(validations.removePlaylistItem),
      route(controller.removePlaylistItem),
    );
}
