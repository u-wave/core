import {
  UserNotFoundError,
  CannotSelfMuteError,
} from '../errors';
import toItemResponse from '../utils/toItemResponse';

export async function muteUser(req) {
  const { user: moderator } = req;
  const { id } = req.params;
  const duration = req.body.time;
  const { users } = req.uwave;

  if (moderator.id === id) {
    throw new CannotSelfMuteError({ unmute: false });
  }

  const user = await users.getUser(id);
  if (!user) throw new UserNotFoundError({ id });

  await user.mute(duration, { moderator });

  return toItemResponse({});
}

export async function unmuteUser(req) {
  const { user: moderator } = req;
  const { id } = req.params;
  const { users } = req.uwave;

  if (moderator.id === id) {
    throw new CannotSelfMuteError({ unmute: true });
  }

  const user = await users.getUser(id);
  if (!user) throw new UserNotFoundError({ id });

  await user.unmute({ moderator });

  return toItemResponse({});
}

export function deleteAll(req) {
  const { user: moderator } = req;
  const { chat } = req.uwave;

  chat.delete({}, { moderator });

  return toItemResponse({});
}

export function deleteByUser(req) {
  const { user: moderator } = req;
  const { chat } = req.uwave;
  const { id } = req.params;

  chat.delete({ userID: id }, { moderator });

  return toItemResponse({});
}

export function deleteMessage(req) {
  const { user: moderator } = req;
  const { chat } = req.uwave;
  const { id } = req.params;

  chat.delete({ id }, { moderator });

  return toItemResponse({});
}
