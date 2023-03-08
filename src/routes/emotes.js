'use strict';

const { Router } = require('express');
const route = require('../route');
const controller = require('../controllers/emotes');

function emotesRoutes() {
  return Router()
    // GET /emotes/ - List available (non-unicode) emotes.
    .get(
      '/',
      route(controller.getEmotes),
    );
}

module.exports = emotesRoutes;
