import express from 'express';

import authenticate from './authenticate';
import playlist from './playlists';
import waitlist from './waitlist';
import booth from './booth';
import users from './users';
import chat from './chat';

/**
 * creates a router for version 1 of the api
 *
 * @param {Object[]} middleware - all middleware that should be injected
 * @param {Object} wareOpts - middleware config, for more information see src/config/middleware.json.example
 * @param {Object} routerOpts - router config, for more information see {@link http://expressjs.com/4x/api.html#router}
 **/
export default function createV1(middleware, wareOpts = {}, routerOpts = {}) {
  const router = express.Router(routerOpts);

  middleware.forEach(ware => {
    if (typeof ware === 'function') {
      ware(router, wareOpts[ware.name.toLowerCase()]);
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
