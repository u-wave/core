import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import route from '../route.js';
import * as validations from '../validations.js';
import protect from '../middleware/protect.js';
import schema from '../middleware/schema.js';
import * as controller from '../controllers/users.js';
import { NameChangeRateLimitError } from '../errors/index.js';
import { Permissions } from '../plugins/acl.js';
import ms from 'ms';

function userRoutes() {
  return Router()
    // GET /users/ - List user accounts.
    .get(
      '/',
      protect(Permissions.UserList),
      route(controller.getUsers),
    )
    // GET /users/:id - Show a single user.
    .get(
      '/:id',
      schema(validations.getUser),
      route(controller.getUser),
    )
    // POST /users/:id/mute - Mute a user in the chat.
    // TODO move this to /mutes/ namespace.
    .post(
      '/:id/mute',
      protect(Permissions.ChatMute),
      schema(validations.muteUser),
      route(controller.muteUser),
    )
    // DELETE /users/:id/mute - Unmute a user in the chat.
    // TODO move this to /mutes/ namespace.
    .delete(
      '/:id/mute',
      protect(Permissions.ChatUnmute),
      schema(validations.unmuteUser),
      route(controller.unmuteUser),
    )
    // GET /users/:id/roles - List the roles that a user has.
    .get(
      '/:id/roles',
      route(controller.getUserRoles),
    )
    // PUT /users/:id/roles/:role - Grant a role to a user.
    .put(
      '/:id/roles/:role',
      protect(),
      schema(validations.addUserRole),
      route(controller.addUserRole),
    )
    // DELETE /users/:id/roles/:role - Remove a role from a user.
    .delete(
      '/:id/roles/:role',
      protect(),
      schema(validations.removeUserRole),
      route(controller.removeUserRole),
    )
    // PUT /users/:id/username - Change a user's username.
    .put(
      '/:id/username',
      protect(),
      schema(validations.setUserName),
      rateLimit({
        limit: 5,
        windowMs: 60 * 60 * 1000,
        identifier: 'name-change',
        keyGenerator: (req) => String(req.query.id),
        handler: (_req, res, next) => {
          next(new NameChangeRateLimitError({
            'retry-after': ms(Number(res.get('Retry-After')) * 1_000, { long: true }),
          }));
        },
      }),
      route(controller.changeUsername),
    )
    // PUT /users/:id/avatar - Change a user's avatar.
    .put(
      '/:id/avatar',
      protect(),
      schema(validations.setUserAvatar),
      route(controller.changeAvatar),
    )
    // GET /users/:id/history - Show recent plays by a user.
    .get(
      '/:id/history',
      schema(validations.getUserHistory),
      route(controller.getHistory),
    );
}

export default userRoutes;
