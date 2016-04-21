import Promise from 'bluebird';
import getYouTubeID from 'get-youtube-id';
import parseIsoDuration from 'parse-iso-duration';
import getArtistTitle, { fallBackToArtist } from 'get-artist-title';
import chunk from 'chunk';
import values from 'object-values';

import googleapis from 'googleapis';

const youTube = googleapis.youtube('v3');

const youTubeSearch = Promise.promisify(youTube.search.list);
const youTubeGet = Promise.promisify(youTube.videos.list);
const youTubeGetChannels = Promise.promisify(youTube.channels.list);
const youTubeGetPlaylists = Promise.promisify(youTube.playlists.list);
const youTubeGetPlaylistItems = Promise.promisify(youTube.playlistItems.list);

function parseYouTubeDuration(duration) {
  return Math.round(parseIsoDuration(duration) / 1000);
}

function selectThumbnail(thumbnails) {
  if (thumbnails) {
    if (thumbnails.high) {
      return thumbnails.high.url;
    } else if (thumbnails.medium) {
      return thumbnails.medium.url;
    } else if (thumbnails.default) {
      return thumbnails.default.url;
    }
  }
  return '';
}

function getRegionRestriction(contentDetails) {
  if (contentDetails.regionRestriction) {
    return contentDetails.regionRestriction.blocked || [];
  }
  return [];
}

function normalizeMedia(video) {
  const [artist, title] = getArtistTitle(video.snippet.title, [
    'base', fallBackToArtist(video.snippet.channelTitle)
  ]);

  return {
    sourceID: video.id,
    // TODO Fix the detection in get-artist-title so that it doesn't split the
    // title into parts with only fluff.
    artist: artist || '[unknown]',
    title: title || '[unknown]',
    duration: parseYouTubeDuration(video.contentDetails.duration),
    thumbnail: selectThumbnail(video.snippet.thumbnails),
    restricted: getRegionRestriction(video.contentDetails)
  };
}

const rxChannelUrl = /youtube\.com\/channel\/([^/?#]+)/i;
const rxUserUrl = /youtube\.com\/user\/([^/?#]+)/i;

const rxSimplePlaylistUrl = /youtube\.com\/playlist\?.*?list=([a-z0-9_-]+)/i;
const rxPlaylistID = /^([a-z0-9_-]+)$/i;
export function getPlaylistID(url) {
  if (rxPlaylistID.test(url)) {
    return url;
  }

  const match = url.match(rxSimplePlaylistUrl);
  if (match) {
    return match[1];
  }
}

const defaultSearchOptions = {
  part: 'id',
  fields: `
    items(id/videoId),
    pageInfo,
    nextPageToken,
    prevPageToken
  `.replace(/\s+/g, ''),
  type: 'video',
  maxResults: 50,
  safeSearch: 'none',
  videoSyndicated: true
};

const getPlaylistsOptions = {
  part: 'snippet,contentDetails',
  fields: `
    items(
      id,
      snippet/title,
      snippet/description,
      snippet/channelTitle,
      snippet/thumbnails,
      contentDetails/itemCount
    ),
    pageInfo,
    nextPageToken
  `.replace(/\s+/g, ''),
  maxResults: 50
};

export default function youTubeSource(uw, opts = {}) {
  const params = opts.key ? { key: opts.key } : {};
  const searchOptions = opts.search || {};

  async function getPage(sourceIDs) {
    const [result] = await youTubeGet({
      ...params,
      part: 'snippet,contentDetails',
      fields: `
        items(
          id,
          snippet(title, channelTitle, thumbnails),
          contentDetails(duration, regionRestriction)
        )
      `.replace(/\s+/g, ''),
      id: sourceIDs.join(',')
    });

    return result.items.map(normalizeMedia);
  }

  async function get(sourceIDs) {
    const pages = await Promise.all(
      chunk(sourceIDs, 50).map(getPage)
    );
    return pages.reduce((result, page) => result.concat(page), []);
  }

  async function search(query, page = null) {
    const [result] = await youTubeSearch({
      ...defaultSearchOptions,
      ...searchOptions,
      ...params,
      // When searching for a video URL, we want to search for the video ID
      // only, because search results are very inconsistent with some types of
      // URLs.
      q: getYouTubeID(query, { fuzzy: false }) || query,
      pageToken: page
    });

    return get(result.items.map(item => item.id.videoId));
  }

  async function getPlaylistPage(playlistID, page = null) {
    const [result] = await youTubeGetPlaylistItems({
      ...params,
      part: 'contentDetails',
      playlistId: playlistID,
      maxResults: 50,
      pageToken: page
    });

    return {
      nextPage: result.nextPageToken,
      items: result.items
    };
  }

  async function getPlaylistItems(playlistID) {
    let page = null;
    const playlistItems = [];
    do {
      const res = await getPlaylistPage(playlistID, page);
      page = res.nextPage;
      playlistItems.push(...res.items);
    } while (page);

    const ids = playlistItems.map(item => item.contentDetails.videoId);
    const medias = await get(ids);

    return medias.map(media => ({
      ...media,
      start: 0,
      end: media.duration
    }));
  }

  async function getPlaylistMeta(playlistID) {
    const [result] = await youTubeGetPlaylists({
      ...params,
      part: 'snippet',
      fields: 'items(id,snippet/title)',
      id: playlistID,
      maxResults: 1
    });
    return result.items[0];
  }

  async function getImportablePlaylist(url) {
    const playlistID = getPlaylistID(url);
    if (!playlistID) {
      throw new Error(
        'Invalid playlist URL. Please provide a direct link to the playlist ' +
        'you want to import.'
      );
    }
    const playlist = await getPlaylistMeta(playlistID);
    const items = await getPlaylistItems(playlistID);
    return {
      playlist: {
        sourceID: playlist.id,
        name: playlist.snippet.title
      },
      items
    };
  }

  async function getChannelMeta(url) {
    let match = url.match(rxChannelUrl);
    const request = {
      ...params,
      part: 'snippet,contentDetails',
      fields: `
        items(
          id,
          snippet/title,
          contentDetails/relatedPlaylists/favorites,
          contentDetails/relatedPlaylists/uploads
        )
      `.replace(/\s+/g, ''),
      maxResults: 1
    };
    if (match) {
      request.id = match[1];
    } else {
      match = url.match(rxUserUrl);
      if (match) {
        request.forUsername = match[1];
      } else {
        throw new Error(
          'Invalid channel URL. Please provide a direct link to the channel or ' +
          'user you want to import playlists from.'
        );
      }
    }

    const [result] = await youTubeGetChannels(request);

    const channel = result.items[0];
    return {
      id: channel.id,
      title: channel.snippet.title,
      playlists: channel.contentDetails.relatedPlaylists
    };
  }

  async function getChannelPlaylistsPage(channelID, page = null) {
    const [result] = await youTubeGetPlaylists({
      ...params,
      ...getPlaylistsOptions,
      channelId: channelID,
      pageToken: page
    });

    return {
      nextPage: result.nextPageToken,
      items: result.items
    };
  }

  async function getChannelPlaylists(channelID) {
    const playlists = [];
    let page;
    do {
      const res = await getChannelPlaylistsPage(channelID, page);
      page = res.nextPage;
      playlists.push(...res.items);
    } while (page);

    return playlists;
  }

  async function getPlaylistMetasForUser(url) {
    const channel = await getChannelMeta(url);

    const specials = youTubeGetPlaylists({
      ...params,
      ...getPlaylistsOptions,
      id: values(channel.playlists)
    });
    const playlists = getChannelPlaylists(channel.id);

    const result = await Promise.all([specials, playlists]);

    const allPlaylists = [
      ...result[0][0].items,
      ...result[1]
    ];

    return {
      channel: { id: channel.id, title: channel.title },
      playlists: allPlaylists.map(item => ({
        sourceID: item.id,
        sourceChannel: item.snippet.channelTitle,
        name: item.snippet.title,
        description: item.snippet.description,
        size: item.contentDetails.itemCount,
        thumbnail: selectThumbnail(item.snippet.thumbnails)
      }))
    };
  }

  async function doImport(ctx, name, playlistID) {
    const items = await getPlaylistItems(playlistID);
    return await ctx.createPlaylist(name, items);
  }

  return {
    search,
    get: get, // eslint-disable-line object-shorthand
    async 'import'(ctx, action) {
      if (action.action === 'channel') {
        return await getPlaylistMetasForUser(action.url);
      }
      if (action.action === 'playlist') {
        const importable = await getImportablePlaylist(action.url);
        importable.items = ctx.source.addSourceType(importable.items);
        return importable;
      }
      if (action.action === 'importplaylist') {
        return await doImport(ctx, action.name, action.id);
      }
    }
  };
}
