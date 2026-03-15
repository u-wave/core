import httpErrors from 'http-errors';
import wrapMiddleware from '../utils/wrapMiddleware.js';
import { KEY_ACTIVE_SESSIONS } from '../SocketServer.js';

const { BadRequest } = httpErrors;

function requireActiveConnection() {
  /**
   * @param {import('../Uwave.js').default} uwave
   * @param {import('../schema.js').User} user
   */
  async function isConnected(uwave, user) {
    const onlineIDs = new Set(
      /** @type {import('../schema.js').UserID[] | null} */ (
        await uwave.keyv.get(KEY_ACTIVE_SESSIONS)
      ) ?? [],
    );
    return onlineIDs.has(user.id);
  }

  return wrapMiddleware(async (req) => {
    const connected = req.user && await isConnected(req.uwave, req.user);
    if (!connected) {
      throw new BadRequest('You need to be logged in and connected to do this.');
    }
  });
}

export default requireActiveConnection;
