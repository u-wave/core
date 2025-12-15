import { sql } from 'kysely';
import { UserNotFoundError, CannotSelfMuteError } from '../errors/index.js';
import { fromJson, json } from '../utils/sqlite.js';
import toItemResponse from '../utils/toItemResponse.js';
import toListResponse from '../utils/toListResponse.js';

/**
 * @typedef {import('../schema').UserID} UserID
 * @typedef {import('../redisMessages.js').ServerActionParameters} ServerActionParameters
 */

const BACKSCROLL_LENGTH = 20;

/**
 * @typedef {object} MuteUserParams
 * @prop {UserID} id
 * @typedef {object} MuteUserBody
 * @prop {number} time
 */

/**
 * @type {import('../types.js').AuthenticatedController<MuteUserParams, {}, MuteUserBody>}
 */
async function muteUser(req) {
  const { user: moderator } = req;
  const { id } = req.params;
  const duration = req.body.time;
  const { chat, users } = req.uwave;

  if (moderator.id === id) {
    throw new CannotSelfMuteError({ action: 'mute' });
  }

  const user = await users.getUser(id);
  if (!user) throw new UserNotFoundError({ id });

  await chat.mute(user, duration, { moderator });

  return toItemResponse({});
}

/**
 * @typedef {object} UnmuteUserParams
 * @prop {UserID} id
 */

/**
 * @type {import('../types.js').AuthenticatedController<UnmuteUserParams>}
 */
async function unmuteUser(req) {
  const { user: moderator } = req;
  const { id } = req.params;
  const { chat, users } = req.uwave;

  if (moderator.id === id) {
    throw new CannotSelfMuteError({ action: 'unmute' });
  }

  const user = await users.getUser(id);
  if (!user) throw new UserNotFoundError({ id });

  await chat.unmute(user, { moderator });

  return toItemResponse({});
}

/**
 * @type {import('../types.js').AuthenticatedController}
 */
async function deleteAll(req) {
  const { user: moderator } = req;
  const { chat } = req.uwave;

  chat.delete({}, { moderator });

  return toItemResponse({});
}

/**
 * @typedef {object} DeleteByUserParams
 * @prop {UserID} id
 */

/**
 * @type {import('../types.js').AuthenticatedController<DeleteByUserParams>}
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
 * @type {import('../types.js').AuthenticatedController<DeleteMessageParams>}
 */
async function deleteMessage(req) {
  const { user: moderator } = req;
  const { chat } = req.uwave;
  const { id } = req.params;

  chat.delete({ id }, { moderator });

  return toItemResponse({});
}

/**
 * @type {import('../types.js').Controller<{}>}
 */
async function getBackscroll(req) {
  const { db, users } = req.uwave;

  const rows = await db.selectFrom('socketMessageQueue')
    .where('command', '=', 'chatMessage')
    .innerJoin('users', (join) => join
      .on('users.id', '=', (eb) => sql`${eb.ref('data')}->>'userID'`))
    .select([
      (eb) => json(eb.ref('data')).as('data'),
      ...users.publicUserColumns,
    ])
    .orderBy('socketMessageQueue.id', 'desc')
    .limit(BACKSCROLL_LENGTH)
    .execute();

  const messages = rows.map((row) => {
    const message = /** @type {ServerActionParameters['chat:message']} */ (fromJson(row.data));
    return {
      _id: message.id,
      /** Deprecated: timestamp as unixy milliseconds */
      timestamp: message.timestamp,
      createdAt: new Date(message.timestamp),
      message: message.message,
      user: {
        _id: row.id,
        username: row.username,
        slug: row.slug,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        avatar: row.avatar,
        roles: row.roles == null ? [] : fromJson(row.roles),
      },
    };
  });

  return toListResponse(messages, {
    included: {
      user: ['user'],
    },
    url: req.fullUrl,
  });
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
  return toItemResponse(result);
}

export {
  muteUser,
  unmuteUser,
  deleteAll,
  deleteByUser,
  deleteMessage,
  getBackscroll,
  sendMessage,
};
