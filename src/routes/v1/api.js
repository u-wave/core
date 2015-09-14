import express from 'express';

import authenticate from './authenticate';
import playlist from './playlist';
import waitlist from './waitlist';
import booth from './booth';
import users from './users';
import chat from './chat';

export default function api(app) {
  let router = express.Router();

  authenticate(router);
  playlist(router);
  waitlist(router);
  booth(router);
  users(router);
  chat(router);

  app.use('/v1', router);
}