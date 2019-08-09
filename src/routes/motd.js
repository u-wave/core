import router from 'router';

import route from '../route';
import * as validations from '../validations';
import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/motd';

export default function motdRoutes() {
  return router()
    // GET /motd/ - Get the message of the day.
    .get(
      '/',
      route(controller.getMotd),
    )
    // PUT /motd/ - Set the message of the day.
    .put(
      '/',
      protect('motd.set'),
      checkFields(validations.setMotd),
      route(controller.setMotd),
    );
}
