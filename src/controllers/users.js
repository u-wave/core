import {
  HTTPError,
  PermissionError,
  UserNotFoundError,
  UserNotInWaitlistError,
} from '../errors/index.js';
import getOffsetPagination from '../utils/getOffsetPagination.js';
import toItemResponse from '../utils/toItemResponse.js';
import toListResponse from '../utils/toListResponse.js';
import toPaginatedResponse from '../utils/toPaginatedResponse.js';
import { muteUser, unmuteUser } from './chat.js';
import { KEY_ACTIVE_SESSIONS } from '../SocketServer.js';

/**
 * @typedef {import('../schema').UserID} UserID
 */

/**
 * @typedef {object} GetUsersQuery
 * @prop {string} filter
 */

/**
 * @type {import('../types.js').AuthenticatedController<{}, GetUsersQuery>}
 */
async function getUsers(req) {
  const { filter } = req.query;
  const pagination = getOffsetPagination(req.query, {
    defaultSize: 50,
  });
  const { users } = req.uwave;

  const userList = await users.getUsers(filter, pagination);

  return toPaginatedResponse(userList, {
    baseUrl: req.fullUrl,
  });
}

/**
 * @typedef {object} GetUserParams
 * @prop {UserID} id
 */

/**
 * @type {import('../types.js').Controller<GetUserParams>}
 */
async function getUser(req) {
  const { users } = req.uwave;
  const { id: userID } = req.params;

  const user = await users.getUser(userID);
  if (!user) {
    throw new UserNotFoundError({ id: userID });
  }

  return toItemResponse(user, {
    url: req.fullUrl,
  });
}

/**
 * @typedef {object} GetUserRolesParams
 * @prop {UserID} id
 */

/**
 * @type {import('../types.js').Controller<GetUserRolesParams>}
 */
async function getUserRoles(req) {
  const { acl, users } = req.uwave;
  const { id } = req.params;

  const user = await users.getUser(id);
  if (!user) {
    throw new UserNotFoundError({ id });
  }

  const roles = await acl.getAllPermissions(user);

  return toListResponse(roles, {
    url: req.fullUrl,
  });
}

/**
 * @typedef {object} AddUserRoleParams
 * @prop {UserID} id
 * @prop {string} role
 */

/**
 * @type {import('../types.js').AuthenticatedController<AddUserRoleParams>}
 */
async function addUserRole(req) {
  const { user: moderator } = req;
  const { id, role } = req.params;
  const { acl, users } = req.uwave;

  const canModifyRoles = moderator.roles.includes('admin');
  if (!canModifyRoles) {
    throw new PermissionError({ requiredRole: 'admin' });
  }

  const user = await users.getUser(id);
  if (!user) {
    throw new UserNotFoundError({ id });
  }

  await acl.allow(user, [role]);

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

/**
 * @typedef {object} RemoveUserRoleParams
 * @prop {UserID} id
 * @prop {string} role
 */

/**
 * @type {import('../types.js').AuthenticatedController<RemoveUserRoleParams>}
 */
async function removeUserRole(req) {
  const { user: moderator } = req;
  const { id, role } = req.params;
  const { acl, users } = req.uwave;

  const canModifyRoles = moderator.roles.includes('admin');
  if (!canModifyRoles) {
    throw new PermissionError({ requiredRole: 'admin' });
  }

  const user = await users.getUser(id);
  if (!user) {
    throw new UserNotFoundError({ id });
  }

  await acl.disallow(user, [role]);

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

/**
 * @typedef {object} ChangeUsernameParams
 * @prop {UserID} id
 * @typedef {object} ChangeUsernameBody
 * @prop {string} username
 */

/**
 * @type {import('../types.js').AuthenticatedController<
 *     ChangeUsernameParams, {}, ChangeUsernameBody>}
 */
async function changeUsername(req) {
  const { user: moderator } = req;
  const { id } = req.params;
  const { username } = req.body;
  const { users } = req.uwave;

  if (id !== moderator.id) {
    throw new PermissionError();
  }

  const user = await users.updateUser(
    id,
    { username },
    { moderator },
  );

  return toItemResponse(user);
}

/**
 * @returns {Promise<import('type-fest').JsonObject>}
 */
async function changeAvatar() {
  throw new HTTPError(500, 'Not implemented');
}

/**
 * Remove the user ID from the online users list.
 *
 * @param {import('../Uwave.js').default} uw
 * @param {UserID} userID
 */
async function disconnectUser(uw, userID) {
  try {
    await uw.booth.removeUser(userID);
  } catch (err) {
    // It's expected that the user would not be in the waitlist
    if (!(err instanceof UserNotInWaitlistError)) {
      throw err;
    }
  }

  try {
    await uw.waitlist.removeUser(userID);
  } catch (err) {
    // It's expected that the user would not be in the waitlist
    if (!(err instanceof UserNotInWaitlistError)) {
      throw err;
    }
  }

  const userIDs = new Set(
    /** @type {import('../schema.js').UserID[] | null} */ (
      await uw.keyv.get(KEY_ACTIVE_SESSIONS)
    ) ?? [],
  );
  userIDs.delete(userID);

  await uw.keyv.set(KEY_ACTIVE_SESSIONS, Array.from(userIDs));

  uw.publish('user:leave', { userID });
}

/**
 * @typedef {object} GetHistoryParams
 * @prop {UserID} id
 */

/**
 * @type {import('../types.js').Controller<GetHistoryParams>}
 */
async function getHistory(req) {
  const { id } = req.params;
  const pagination = getOffsetPagination(req.query, {
    defaultSize: 25,
    maxSize: 100,
  });
  const uw = req.uwave;

  const user = await uw.users.getUser(id);
  if (!user) {
    throw new UserNotFoundError({ id });
  }

  const history = await uw.history.getUserHistory(user, pagination);

  return toPaginatedResponse(history, {
    baseUrl: req.fullUrl,
    included: {
      media: ['media.media'],
      user: ['user'],
    },
  });
}

export {
  getUsers,
  getUser,
  getUserRoles,
  addUserRole,
  removeUserRole,
  changeUsername,
  changeAvatar,
  disconnectUser,
  getHistory,
  muteUser,
  unmuteUser,
};
