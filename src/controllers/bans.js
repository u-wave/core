'use strict';

const { UserNotFoundError } = require('../errors');
const getOffsetPagination = require('../utils/getOffsetPagination');
const toItemResponse = require('../utils/toItemResponse');
const toPaginatedResponse = require('../utils/toPaginatedResponse');

/**
 * @typedef {object} GetBansQuery
 * @prop {string} filter
 */

/**
 * @type {import('../types').AuthenticatedController<{}, GetBansQuery>}
 */
async function getBans(req) {
  const { bans } = req.uwave;
  const { filter } = req.query;
  const pagination = getOffsetPagination(req.query);

  const bansList = await bans.getBans(filter, pagination);

  return toPaginatedResponse(bansList, {
    included: {
      user: ['user', 'moderator'],
    },
    baseUrl: req.fullUrl,
  });
}

/**
 * @typedef {object} AddBanBody
 * @prop {number} [duration]
 * @prop {string} userID
 * @prop {boolean} [permanent]
 * @prop {string} [reason]
 */

/**
 * @type {import('../types').AuthenticatedController<{}, {}, AddBanBody>}
 */
async function addBan(req) {
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

/**
 * @typedef {object} RemoveBanParams
 * @prop {string} userID
 */

/**
 * @type {import('../types').AuthenticatedController<RemoveBanParams>}
 */
async function removeBan(req) {
  const { user: moderator } = req;
  const { bans } = req.uwave;
  const { userID } = req.params;

  await bans.unban(userID, { moderator });

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

exports.getBans = getBans;
exports.addBan = addBan;
exports.removeBan = removeBan;
