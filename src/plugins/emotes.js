'use strict';

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
 */

/**
 * @template {object} T
 * @param {URL|string} url
 * @returns {Promise<T>}
 */
async function fetchJSON(url) {
  const res = await fetch(url);
  const json = await res.json();
  return json;
}

/**
 * @param {string[]} channels
 * @returns {Promise<Record<string, URL>>}
 */
async function loadBTTVEmotes(channels) {
  /** @type {Record<string, URL>} */
  const emotes = {};

  /**
   * @param {string} channelId
   * @returns {Promise<BTTVEmote[]>}
   */
  async function loadChannelEmotes(channelId) {
    /** @type {{ channelEmotes: BTTVEmote[], sharedEmotes: BTTVEmote[] }} */
    const channel = await fetchJSON(`https://api.betterttv.net/3/cached/users/twitch/${channelId}`);
    const { channelEmotes, sharedEmotes } = channel;

    return [...channelEmotes, ...sharedEmotes];
  }

  const list = await Promise.all([
    /** @type {Promise<BTTVEmote[]>} */ (fetchJSON('https://api.betterttv.net/3/cached/emotes/global')),
    ...channels.map((channelId) => loadChannelEmotes(channelId)),
  ]);

  for (const emote of list.flat()) {
    emotes[emote.code.replace(/(^:|:$)/g, '')] = new URL(`https://cdn.betterttv.net/emote/${emote.id}/2x`);
  }

  return emotes;
}

/**
 * @param {string[]} channels
 * @returns {Promise<Record<string, URL>>}
 */
async function loadSevenTVEmotes(channels) {
  /** @type {Record<string, URL>} */
  const emotes = {};

  /**
   * @param {string} channelId
   * @returns {Promise<SevenTVEmote[]>}
   */
  async function loadChannelEmotes(channelId) {
    /** @type {{ emote_set: { emotes: SevenTVEmote[] } }} */
    const channel = await fetchJSON(`https://7tv.io/v3/users/twitch/${channelId}`);

    return channel.emote_set.emotes;
  }

  /** @type {Promise<{ emotes: SevenTVEmote[] }>} */
  const global = fetchJSON('https://7tv.io/v3/emote-sets/global');
  const list = await Promise.all([
    global.then((data) => data.emotes),
    ...channels.map((channelId) => loadChannelEmotes(channelId)),
  ]);

  for (const emote of list.flat()) {
    const ext = emote.data.animated ? 'gif' : 'png';
    emotes[emote.name] = new URL(`https://cdn.7tv.app/emote/${emote.id}/2x.${ext}`);
  }

  return emotes;
}

/**
 * @param {TwitchSettings} options
 * @returns {Promise<Record<string, URL>>}
 */
async function loadTTVEmotes(options) {
  /** @type {Record<string, URL>} */
  const emotes = {};

  if (!options.clientId || !options.clientSecret) {
    return emotes;
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

  const twitchEmotes = await Promise.all([
    options.useTwitchGlobalEmotes ? client.chat.getGlobalEmotes() : [],
    ...channels.map((channelId) => client.chat.getChannelEmotes(channelId)),
  ]);
  for (const emote of twitchEmotes.flat()) {
    emotes[emote.name] = new URL(emote.getImageUrl(2));
  }

  if (options.bttv) {
    Object.assign(emotes, await loadBTTVEmotes(channels));
  }

  if (options.seventv) {
    Object.assign(emotes, await loadSevenTVEmotes(channels));
  }

  return emotes;
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

  /** @type {Record<string, URL>} */
  #emotes = Object.create(null);

  #ready = Promise.resolve();

  /**
   * @param {import('../Uwave').Boot} uw
   */
  constructor(uw) {
    this.#uw = uw;

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

  async #reloadEmotes() {
    const config = /** @type {EmotesSettings} */ (await this.#uw.config.get(schema['uw:key']));

    if (config.twitch) {
      this.#emotes = await loadTTVEmotes(config.twitch);
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
