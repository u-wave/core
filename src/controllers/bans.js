import { UserNotFoundError } from '../errors';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toPaginatedResponse from '../utils/toPaginatedResponse';

export async function getBans(req) {
  const { bans } = req.uwave;
  const { filter } = req.query;
  const pagination = getOffsetPagination(req.query);

  const bansList = await bans.getBans(filter, pagination);

  return toPaginatedResponse(bansList, {
    included: {
      user: ['user'],
    },
    baseUrl: req.fullUrl,
  });
}

export async function addBan(req) {
  const { user: moderator } = req;
  const { users, bans } = req.uwave;
  const {
    duration = 0,
    userID,
    permanent = false,
    reason = '',
  } = req.body;

  const user = await users.getUser(userID);
  if (!user) {
    throw new UserNotFoundError({ id: userID });
  }

  const ban = await bans.ban(user, {
    moderator,
    duration,
    permanent,
    reason,
  });

  return toItemResponse(ban, {
    url: req.fullUrl,
  });
}

export async function removeBan(req) {
  const { user: moderator } = req;
  const { bans } = req.uwave;
  const { userID } = req.params;

  await bans.unban(userID, { moderator });

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}
