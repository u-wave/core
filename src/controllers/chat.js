'use strict';

const {
  UserNotFoundError,
  CannotSelfMuteError,
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
 * @type {import('../types').Controller<MuteUserParams, {}, MuteUserBody>}
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
 * @type {import('../types').Controller<UnmuteUserParams>}
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
 * @type {import('../types').Controller}
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
 * @type {import('../types').Controller<DeleteByUserParams>}
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
 * @type {import('../types').Controller<DeleteMessageParams>}
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
exports.deleteAll = deleteAll;
exports.deleteByUser = deleteByUser;
exports.deleteMessage = deleteMessage;
