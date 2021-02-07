'use strict';

const router = require('router');
const route = require('../route');
const validations = require('../validations');
const protect = require('../middleware/protect');
const schema = require('../middleware/schema');
const controller = require('../controllers/booth');

function boothRoutes() {
  return router()
    // GET /booth/ - Get the current booth status.
    .get(
      '/',
      route(controller.getBooth),
    )
    // POST /booth/skip - Skip the current DJ's play.
    .post(
      '/skip',
      protect(),
      schema(validations.skipBooth),
      route(controller.skipBooth),
    )
    // POST /booth/replace - Replace the current DJ with someone else.
    .post(
      '/replace',
      protect('booth.replace'),
      schema(validations.replaceBooth),
      route(controller.replaceBooth),
    )
    // GET /booth/:historyID/vote - Get the current user's vote for the current play.
    .get(
      '/:historyID/vote',
      protect(),
      schema(validations.getVote),
      route(controller.getVote),
    )
    // PUT /booth/:historyID/vote - Upvote or downvote the current play.
    .put(
      '/:historyID/vote',
      protect(),
      schema(validations.vote),
      route(controller.vote),
    )
    // POST /booth/favorite - Add the current play to your favorites.
    .post(
      '/favorite',
      protect(),
      schema(validations.favorite),
      route(controller.favorite),
    )
    // GET /booth/history - Get recent plays.
    .get(
      '/history',
      schema(validations.getRoomHistory),
      route(controller.getHistory),
    );
}

module.exports = boothRoutes;
