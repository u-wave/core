'use strict';

const { NotFound } = require('http-errors');
const { AppTokenAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');
const fetch = require('node-fetch').default;
const routes = require('../routes/emotes');
const schema = require('../schemas/emotes.json');

/**
 * @typedef {{
 *   clientId: string | null,
 *   clientSecret: string | null,
 *   useTwitchGlobalEmotes: boolean,
 *   bttv: boolean,
 *   seventv: boolean,
 *   channels: string[],
 * }} TwitchSettings
 * @typedef {{ twitch: TwitchSettings }} EmotesSettings
 *
 * @typedef {{ id: string, code: string, imageType: string, animated: boolean }} BTTVEmote
 * @typedef {{ id: string, name: string, data: { animated: boolean } }} SevenTVEmote
 * @typedef {{ name: string, url: URL }} Emote
 */

/**
 * @template {object} T
 * @param {URL|string} url
 * @returns {Promise<T>}
 */
async function fetchJSON(url) {
  const res = await fetch(url);

  if (!res.ok) {
    if (res.status === 404) {
      throw new NotFound();
    }
    throw new Error('Unexpected response');
  }

  const json = await res.json();
  return json;
}

/**
* @param {BTTVEmote} bttv
* @returns {Emote}
*/
function fromBTTVEmote(bttv) {
  return {
    // The `replace` is basically just for :tf: …
    name: bttv.code.replace(/(^:|:$)/g, ''),
    url: new URL(`https://cdn.betterttv.net/emote/${bttv.id}/2x`),
  };
}

async function getBTTVGlobalEmotes() {
  /** @type {BTTVEmote[]} */
  const emotes = await fetchJSON('https://api.betterttv.net/3/cached/emotes/global');
  return emotes.map(fromBTTVEmote);
}

/**
 * @param {string} channelId
 * @returns {Promise<Emote[]>}
 */
async function getBTTVChannelEmotes(channelId) {
  let channel = null;
  try {
    channel = /** @type {{ channelEmotes: BTTVEmote[], sharedEmotes: BTTVEmote[] }} */ (
      await fetchJSON(`https://api.betterttv.net/3/cached/users/twitch/${channelId}`)
    );
  } catch (err) {
    if (!(err instanceof NotFound)) {
      throw err;
    }
  }
  if (!channel) {
    return [];
  }

  const { channelEmotes, sharedEmotes } = channel;

  return [...channelEmotes, ...sharedEmotes].map(fromBTTVEmote);
}

/**
 * @param {string[]} channels
 * @returns {Promise<Emote[]>}
 */
async function getBTTVEmotes(channels) {
  const list = await Promise.all([
    getBTTVGlobalEmotes(),
    ...channels.map((channelId) => getBTTVChannelEmotes(channelId)),
  ]);

  return list.flat();
}

/**
 * @param {SevenTVEmote} emote
 * @returns {Emote}
 */
function fromSevenTVEmote(emote) {
  const ext = emote.data.animated ? 'gif' : 'png';
  return {
    name: emote.name,
    url: new URL(`https://cdn.7tv.app/emote/${emote.id}/2x.${ext}`),
  };
}

/**
 * @param {string} channelId
 * @returns {Promise<Emote[]>}
 */
async function getSevenTVChannelEmotes(channelId) {
  let channel = null;
  try {
    channel = /** @type {{ emote_set?: { emotes: SevenTVEmote[] } }} */ (
      await fetchJSON(`https://7tv.io/v3/users/twitch/${channelId}`)
    );
  } catch (err) {
    if (!(err instanceof NotFound)) {
      throw err;
    }
  }
  if (!channel || !channel.emote_set) {
    return [];
  }

  return channel.emote_set.emotes.map(fromSevenTVEmote);
}

/**
 * @param {string[]} channels
 * @returns {Promise<Emote[]>}
 */
async function getSevenTVEmotes(channels) {
  /** @type {Promise<{ emotes: SevenTVEmote[] }>} */
  const global = fetchJSON('https://7tv.io/v3/emote-sets/global');
  const emotes = await Promise.all([
    global.then((data) => data.emotes.map(fromSevenTVEmote)),
    ...channels.map((channelId) => getSevenTVChannelEmotes(channelId)),
  ]);

  return emotes.flat();
}

/**
 * @param {import('@twurple/api').HelixEmote} emote
 * @returns {Emote}
 */
function fromTwitchEmote(emote) {
  return {
    name: emote.name,
    url: new URL(emote.getImageUrl(2)),
  };
}

/**
 * EXPERIMENTAL: load emotes from Twitch emote services.
 *
 * Before considering this stable:
 * - error handling must be improved.
 * - global emotes from the emote services should be optional.
 */
class Emotes {
  #uw;

  #logger;

  /** @type {Record<string, URL>} */
  #emotes = Object.create(null);

  #ready = Promise.resolve();

  /**
   * @param {import('../Uwave').Boot} uw
   */
  constructor(uw) {
    this.#uw = uw;
    this.#logger = uw.logger.child({ ns: 'uwave:emotes' });

    uw.config.register(schema['uw:key'], schema);
    const unsubscribe = uw.config.subscribe(
      schema['uw:key'],
      () => {
        this.#ready = this.#reloadEmotes();
      },
    );
    uw.onClose(unsubscribe);

    this.#ready = this.#reloadEmotes();
  }

  async getEmotes() {
    await this.#ready;

    return Object.entries(this.#emotes).map(([name, url]) => ({ name, url: url.toString() }));
  }

  /**
   * @param {TwitchSettings} options
   * @returns {Promise<Record<string, URL>>}
   */
  async #loadTTVEmotes(options) {
    if (!options.clientId || !options.clientSecret) {
      return {};
    }

    const client = new ApiClient({
      authProvider: new AppTokenAuthProvider(options.clientId, options.clientSecret),
    });

    const channels = /** @type {string[]} */ ((
      await Promise.all(options.channels.map(async (channelName) => {
        const user = await client.users.getUserByName(channelName);
        return user?.id;
      }))
    ).filter((id) => id != null));

    const promises = channels.map(async (channelId) => {
      const list = await client.chat.getChannelEmotes(channelId);
      return list.map(fromTwitchEmote);
    });
    if (options.useTwitchGlobalEmotes) {
      promises.push(
        client.chat.getGlobalEmotes().then((globalEmotes) => globalEmotes.map(fromTwitchEmote)),
      );
    }

    if (options.bttv) {
      promises.push(getBTTVEmotes(channels));
    }

    if (options.seventv) {
      promises.push(getSevenTVEmotes(channels));
    }

    /** @type {Record<string, URL>} */
    const emotes = {};

    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const emote of result.value) {
          emotes[emote.name] = emote.url;
        }
      } else {
        this.#logger.warn(result.reason);
      }
    }

    return emotes;
  }

  async #reloadEmotes() {
    this.#logger.info('reloading third-party emotes');

    const config = /** @type {EmotesSettings} */ (await this.#uw.config.get(schema['uw:key']));

    if (config.twitch) {
      this.#emotes = await this.#loadTTVEmotes(config.twitch);
    }

    this.#uw.publish('emotes:reload', null);
  }
}

/**
 * @param {import('../Uwave').Boot} uw
 * @returns {Promise<void>}
 */
async function emotesPlugin(uw) {
  uw.emotes = new Emotes(uw); // eslint-disable-line no-param-reassign
  uw.httpApi.use('/emotes', routes());
}

module.exports = emotesPlugin;
module.exports.Emotes = Emotes;
