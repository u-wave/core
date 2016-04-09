import Promise from 'bluebird';
import getYouTubeID from 'get-youtube-id';
import parseIsoDuration from 'parse-iso-duration';
import getArtistTitle, { fallBackToArtist } from 'get-artist-title';
import chunk from 'chunk';

import googleapis from 'googleapis';

const youTube = googleapis.youtube('v3');

const youTubeSearch = Promise.promisify(youTube.search.list);
const youTubeGet = Promise.promisify(youTube.videos.list);

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
    artist, title,
    duration: Math.round(parseIsoDuration(video.contentDetails.duration) / 1000),
    thumbnail: selectThumbnail(video.snippet.thumbnails),
    restricted: getRegionRestriction(video.contentDetails)
  };
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

  return {
    search,
    get: get // eslint-disable-line object-shorthand
  };
}
