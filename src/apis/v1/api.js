import express from 'express';

import authenticate from './authenticate';
import playlist from './playlists';
import waitlist from './waitlist';
import booth from './booth';
import users from './users';
import chat from './chat';

export default function createV1(middleware, options = {}) {
  let router = express.Router(options);

  middleware.forEach(ware => {
    if(typeof ware === 'function') {
      ware(router, options[ware.name]);
    }
  });

  authenticate(router);
  playlist(router);
  waitlist(router);
  booth(router);
  users(router);
  chat(router);

  return router;
}
