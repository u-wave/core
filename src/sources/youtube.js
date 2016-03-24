import Promise from 'bluebird';
import parseIsoDuration from 'parse-iso-duration';
import getArtistTitle from 'get-artist-title';

import googleapis from 'googleapis';

const youTube = googleapis.youtube('v3');

const youTubeSearch = Promise.promisify(youTube.search.list);
const youTubeGet = Promise.promisify(youTube.videos.list);

// Create a getArtistTitle plugin to fall back to the given artist name when no
// other plugins detected an artist/title combination.
function fallBackToArtist(artist) {
  return {
    splitArtistTitle: title => [artist, title]
  };
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
    artist, title,
    duration: Math.round(parseIsoDuration(video.contentDetails.duration) / 1000),
    thumbnail: selectThumbnail(video.snippet.thumbnails),
    restricted: getRegionRestriction(video.contentDetails)
  };
}

export default function youTubeSource(uw, opts = {}) {
  const params = opts.key ? { key: opts.key } : {};

  async function get(sourceIDs) {
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

  async function search(query, page = null) {
    const [result] = await youTubeSearch({
      ...params,
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
      videoSyndicated: true,
      q: query,
      pageToken: page
    });

    return get(result.items.map(item => item.id.videoId));
  }

  return {
    search,
    get: get // eslint-disable-line object-shorthand
  };
}
