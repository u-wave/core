'use strict';

const {
  UserNotFoundError,
  CannotSelfMuteError,
  ChatMutedError,
} = require('../errors');
const toItemResponse = require('../utils/toItemResponse');

/**
 * @typedef {object} MuteUserParams
 * @prop {string} id
 *
 * @typedef {object} MuteUserBody
 * @prop {number} time
 */

/**
 * @type {import('../types').AuthenticatedController<MuteUserParams, {}, MuteUserBody>}
 */
async function muteUser(req) {
  const { user: moderator } = req;
  const { id } = req.params;
  const duration = req.body.time;
  const { chat, users } = req.uwave;

  if (moderator.id === id) {
    throw new CannotSelfMuteError({ unmute: false });
  }

  const user = await users.getUser(id);
  if (!user) throw new UserNotFoundError({ id });

  await chat.mute(user, duration, { moderator });

  return toItemResponse({});
}

/**
 * @typedef {object} UnmuteUserParams
 * @prop {string} id
 */

/**
 * @type {import('../types').AuthenticatedController<UnmuteUserParams>}
 */
async function unmuteUser(req) {
  const { user: moderator } = req;
  const { id } = req.params;
  const { chat, users } = req.uwave;

  if (moderator.id === id) {
    throw new CannotSelfMuteError({ unmute: true });
  }

  const user = await users.getUser(id);
  if (!user) throw new UserNotFoundError({ id });

  await chat.unmute(user, { moderator });

  return toItemResponse({});
}

/**
 * @typedef {object} SendMessageBody
 * @prop {string} message
 */

/**
 * @type {import('../types').AuthenticatedController<{}, {}, SendMessageBody>}
 */
async function sendMessage(req) {
  const { user } = req;
  const { message } = req.body;
  const { chat } = req.uwave;

  const result = await chat.send(user, message);
  if (!result) {
    throw new ChatMutedError();
  }
  return toItemResponse(result);
}

/**
 * @type {import('../types').AuthenticatedController}
 */
async function deleteAll(req) {
  const { user: moderator } = req;
  const { chat } = req.uwave;

  chat.delete({}, { moderator });

  return toItemResponse({});
}

/**
 * @typedef {object} DeleteByUserParams
 * @prop {string} id
 */

/**
 * @type {import('../types').AuthenticatedController<DeleteByUserParams>}
 */
async function deleteByUser(req) {
  const { user: moderator } = req;
  const { chat } = req.uwave;
  const { id } = req.params;

  chat.delete({ userID: id }, { moderator });

  return toItemResponse({});
}

/**
 * @typedef {object} DeleteMessageParams
 * @prop {string} id
 */

/**
 * @type {import('../types').AuthenticatedController<DeleteMessageParams>}
 */
async function deleteMessage(req) {
  const { user: moderator } = req;
  const { chat } = req.uwave;
  const { id } = req.params;

  chat.delete({ id }, { moderator });

  return toItemResponse({});
}

exports.muteUser = muteUser;
exports.unmuteUser = unmuteUser;
exports.sendMessage = sendMessage;
exports.deleteAll = deleteAll;
exports.deleteByUser = deleteByUser;
exports.deleteMessage = deleteMessage;
