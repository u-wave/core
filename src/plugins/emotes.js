import fs from 'node:fs';
import httpErrors from 'http-errors';
import { AppTokenAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import nodeFetch from 'node-fetch';
import routes from '../routes/emotes.js';

const { NotFound } = httpErrors;
const schema = JSON.parse(
  fs.readFileSync(new URL('../schemas/emotes.json', import.meta.url), 'utf8'),
);

/**
 * @typedef {{
 *   clientId: string | null,
 *   clientSecret: string | null,
 *   useTwitchGlobalEmotes: boolean,
 *   bttv: boolean,
 *   ffz: boolean,
 *   seventv: boolean,
 *   channels: string[],
 * }} TwitchSettings
 * @typedef {{ twitch: TwitchSettings }} EmotesSettings
 *
 * @typedef {{ id: string, code: string, imageType: string, animated: boolean }} BTTVEmote
 * @typedef {{ id: string, name: string }} FFZEmote
 * @typedef {{ emoticons: FFZEmote[] }} FFZEmoteSet
 * @typedef {{ id: string, name: string, data: { animated: boolean } }} SevenTVEmote
 * @typedef {{ name: string, url: URL }} Emote
 */

/**
 * A Map of emote names to URLs.
 *
 * @augments {Map<string, URL>}
 */
class EmoteMap extends Map {
  /**
   * Add an emote to the map. If an emote with the same name already exists,
   * this tries to add a numeric suffix to distinguish them.
   *
   * @param {Emote} emote
   */
  insert(emote) {
    if (this.has(emote.name)) {
      for (let i = 1; i < 20; i += 1) {
        if (!this.has(`${emote.name}~${i}`)) {
          this.set(`${emote.name}~${i}`, emote.url);
        }
      }
    } else {
      this.set(emote.name, emote.url);
    }
  }
}

/**
 * @template {object} T
 * @param {URL|string} url
 * @returns {Promise<T>}
 */
async function fetchJSON(url) {
  const res = await nodeFetch(url);

  if (!res.ok) {
    if (res.status === 404) {
      throw new NotFound();
    }
    throw new Error('Unexpected response');
  }

  const json = /** @type {T} */ (await res.json());
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
* @param {FFZEmote} emote
* @returns {Emote}
*/
function fromFFZEmote(emote) {
  return {
    name: emote.name,
    url: new URL(`https://cdn.frankerfacez.com/emoticon/${emote.id}/2`),
  };
}

/**
 * @param {string} channelName
 * @returns {Promise<Emote[]>}
 */
async function getFFZChannelEmotes(channelName) {
  let channel = null;
  try {
    channel = /** @type {{ sets: Record<number, FFZEmoteSet> }} */ (
      await fetchJSON(`https://api.frankerfacez.com/v1/room/${channelName}`)
    );
  } catch (err) {
    if (!(err instanceof NotFound)) {
      throw err;
    }
  }
  if (!channel) {
    return [];
  }

  return Object.values(channel.sets)
    .flatMap((set) => set.emoticons)
    .map(fromFFZEmote);
}

/**
 * @param {string[]} channels
 * @returns {Promise<Emote[]>}
 */
async function getFFZEmotes(channels) {
  const list = await Promise.all(channels.map((channelId) => getFFZChannelEmotes(channelId)));

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

  #emotes = new EmoteMap();

  #ready = Promise.resolve();

  /**
   * @param {import('../Uwave.js').Boot} uw
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

  /** Get all known emotes as an array. */
  async getEmotes() {
    await this.#ready;

    const emotes = [];
    for (const [name, url] of this.#emotes) {
      emotes.push({ name, url: url.toString() });
    }

    return emotes;
  }

  /**
   * @param {TwitchSettings} options
   * @returns {Promise<EmoteMap>}
   */
  async #loadTTVEmotes(options) {
    if (!options.clientId || !options.clientSecret) {
      return new EmoteMap();
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

    if (options.ffz) {
      promises.push(getFFZEmotes(options.channels));
    }

    if (options.seventv) {
      promises.push(getSevenTVEmotes(channels));
    }

    const emotes = new EmoteMap();

    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const emote of result.value) {
          emotes.insert(emote);
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
 * @param {import('../Uwave.js').Boot} uw
 * @returns {Promise<void>}
 */
async function emotesPlugin(uw) {
  uw.emotes = new Emotes(uw); // eslint-disable-line no-param-reassign
  uw.httpApi.use('/emotes', routes());
}

export default emotesPlugin;
export { Emotes };
