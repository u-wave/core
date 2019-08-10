import createDebug from 'debug';
import {
  HTTPError,
  PermissionError,
  UserNotFoundError,
} from '../errors';
import skipIfCurrentDJ from '../utils/skipIfCurrentDJ';
import removeFromWaitlist from '../utils/removeFromWaitlist';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';
import toPaginatedResponse from '../utils/toPaginatedResponse';
import beautifyDuplicateKeyError from '../utils/beautifyDuplicateKeyError';

export { muteUser, unmuteUser } from './chat';

const debug = createDebug('uwave:http:users');

export async function getUsers(req) {
  const { filter } = req.query;
  const pagination = getOffsetPagination(req.query, {
    defaultSize: 50,
  });
  const { users } = req.uwave;

  debug('getUsers', filter, pagination);

  const userList = await users.getUsers(filter, pagination);

  return toPaginatedResponse(userList, {
    baseUrl: req.fullUrl,
    filter,
  });
}

export async function getUser(req) {
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

export async function getUserRoles(req) {
  const { users } = req.uwave;
  const { id } = req.params;

  const user = await users.getUser(id);
  if (!user) {
    throw new UserNotFoundError({ id });
  }

  const roles = await user.getPermissions();

  return toListResponse(roles, {
    url: req.fullUrl,
  });
}

export async function addUserRole(req) {
  const { user: moderator } = req;
  const { id, role } = req.params;
  const { users } = req.uwave;

  const selfHasRole = await moderator.can(role);
  if (!selfHasRole) {
    throw new PermissionError('You cannot assign roles you do not have');
  }

  const user = await users.getUser(id);
  if (!user) {
    throw new UserNotFoundError({ id });
  }

  await user.allow([role]);

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

export async function removeUserRole(req) {
  const { user: moderator } = req;
  const { id, role } = req.params;
  const { users } = req.uwave;

  const selfHasRole = await moderator.can(role);
  if (!selfHasRole) {
    throw new PermissionError('You cannot remove roles you do not have');
  }

  const user = await users.getUser(id);
  if (!user) {
    throw new UserNotFoundError({ id });
  }

  await user.disallow([role]);

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

export async function changeUsername(req) {
  const { user: moderator } = req;
  const { id } = req.params;
  const { username } = req.body;
  const { users } = req.uwave;

  try {
    const user = await users.updateUser(
      id,
      { username },
      { moderator },
    );

    return toItemResponse(user);
  } catch (error) {
    throw beautifyDuplicateKeyError(error);
  }
}

export async function changeAvatar() {
  throw new HTTPError(500, 'Not implemented');
}

export async function disconnectUser(uw, user) {
  const userID = typeof user === 'object' ? `${user._id}` : user;

  await skipIfCurrentDJ(uw, userID);

  try {
    await removeFromWaitlist(uw, userID);
  } catch (e) {
    // Ignore
  }

  await uw.redis.lrem('users', 0, userID);

  uw.publish('user:leave', { userID });
}

export async function getHistory(req) {
  const { id } = req.params;
  const pagination = getOffsetPagination(req.query, {
    defaultSize: 25,
    maxSize: 100,
  });
  const { users } = req.uwave;

  const user = await users.getUser(id);
  if (!user) {
    throw new UserNotFoundError({ id });
  }

  const history = await user.getHistory(pagination);

  return toPaginatedResponse(history, {
    baseUrl: req.fullUrl,
    included: {
      media: ['media.media'],
      user: ['user'],
    },
  });
}
