import express from 'express';
import debug from 'debug';

import authenticate from './authenticate';
import playlist from './playlists';
import waitlist from './waitlist';
import booth from './booth';
import users from './users';
import chat from './chat';

const log = debug('api:v1');

/**
 * creates a router for version 1 of the api
 *
 * @param {Object[]} middleware - all middleware that should be injected
 * @param {Object} wareOpts - middleware config, for more information see src/config/middleware.json.example
 * @param {Object} routerOpts - router config, for more information see {@link http://expressjs.com/4x/api.html#router}
 **/
export default function createV1(middleware, options = {}) {
  const router = express.Router(options);

  middleware.forEach((item, index) => {
    if (typeof item === 'function') {
      router.use(item);
      log(`registered middleware ${item.name}`);
    } else if (typeof item === 'object') {
      router.use(item.path, item.ware);
      log(`registered middleware ${item.middleware.name}`);
    } else {
      log(`problem with registering middleware at index: ${index}`);
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
