import router from 'router';
import route from '../route';
import * as validations from '../validations';
import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/booth';

export default function boothRoutes() {
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
      checkFields(validations.skipBooth),
      route(controller.skipBooth),
    )
    // POST /booth/replace - Replace the current DJ with someone else.
    .post(
      '/replace',
      protect('booth.replace'),
      checkFields(validations.replaceBooth),
      route(controller.replaceBooth),
    )
    // GET /booth/:historyID/vote - Get the current user's vote for the current play.
    .get(
      '/:historyID/vote',
      protect(),
      checkFields(validations.getVote),
      route(controller.getVote),
    )
    // PUT /booth/:historyID/vote - Upvote or downvote the current play.
    .put(
      '/:historyID/vote',
      protect(),
      checkFields(validations.vote),
      route(controller.vote),
    )
    // POST /booth/favorite - Add the current play to your favorites.
    .post(
      '/favorite',
      protect(),
      checkFields(validations.favorite),
      route(controller.favorite),
    )
    // GET /booth/history - Get recent plays.
    .get(
      '/history',
      checkFields(validations.getRoomHistory),
      route(controller.getHistory),
    );
}
