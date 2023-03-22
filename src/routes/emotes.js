import { Router } from 'express';
import route from '../route.js';
import * as controller from '../controllers/emotes.js';

function emotesRoutes() {
  return Router()
    // GET /emotes/ - List available (non-unicode) emotes.
    .get(
      '/',
      route(controller.getEmotes),
    );
}

export default emotesRoutes;
