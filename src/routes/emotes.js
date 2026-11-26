import { Router } from 'express';
import * as controller from '../controllers/emotes.js';
import route from '../route.js';

function emotesRoutes() {
  return Router()
    // GET /emotes/ - List available (non-unicode) emotes.
    .get(
      '/',
      route(controller.getEmotes),
    );
}

export default emotesRoutes;
