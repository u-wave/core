export default function playlists(router) {
  router.route('/playlists')

  .get((req, res) => {

  })

  .post((req, res) => {

  });

  router.route('/playlists/:id')

  .get((req, res) => {

  })

  .delete((req, res) => {

  });

  router.put('/playlists/:id/rename', (req, res) => {

  });

  router.put('/playlists/:id/share', (req, res) => {

  });

  router.put('/playlists/:id/activate', (req, res) => {

  });

  router.get('/playlists/:id/media', (req, res) => {

  });

  router.route('/playlists/:id/media/:mediaID')

  .get((req, res) => {

  })

  .put((req, res) => {

  })

  .delete((req, res) => {

  });
}
