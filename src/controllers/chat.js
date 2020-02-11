const {
  UserNotFoundError,
  CannotSelfMuteError,
} = require('../errors');
const toItemResponse = require('../utils/toItemResponse');

async function muteUser(req) {
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

async function unmuteUser(req) {
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

function deleteAll(req) {
  const { user: moderator } = req;
  const { chat } = req.uwave;

  chat.delete({}, { moderator });

  return toItemResponse({});
}

function deleteByUser(req) {
  const { user: moderator } = req;
  const { chat } = req.uwave;
  const { id } = req.params;

  chat.delete({ userID: id }, { moderator });

  return toItemResponse({});
}

function deleteMessage(req) {
  const { user: moderator } = req;
  const { chat } = req.uwave;
  const { id } = req.params;

  chat.delete({ id }, { moderator });

  return toItemResponse({});
}

exports.muteUser = muteUser;
exports.unmuteUser = unmuteUser;
exports.deleteAll = deleteAll;
exports.deleteByUser = deleteByUser;
exports.deleteMessage = deleteMessage;
