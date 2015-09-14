import express from 'express';

import middleware from './middleware';

import authenticate from './authenticate';
import playlist from './playlists';
import waitlist from './waitlist';
import booth from './booth';
import users from './users';
import chat from './chat';

export default function api(app, config) {
  const router = express.Router();

  middleware(app, config)

  authenticate(router);
  playlist(router);
  waitlist(router);
  booth(router);
  users(router);
  chat(router);

  app.use('/v1', router);
}
