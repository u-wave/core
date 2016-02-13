import Promise from 'bluebird';
import requestCb from 'request';
import getArtistTitle from 'get-artist-title';

const request = Promise.promisify(requestCb.defaults({
  baseUrl: 'https://api.soundcloud.com',
  json: true
}));

const PAGE_SIZE = 50;

// Create a getArtistTitle plugin to fall back to the given artist name when no
// other plugins detected an artist/title combination.
function fallBackToArtist(artist) {
  return {
    splitArtistTitle: title => [artist, title]
  };
}

function normalizeMedia(media) {
  const [artist, title] = getArtistTitle(media.title, [
    'base', fallBackToArtist(media.user.username)
  ]);
  return {
    sourceID: media.id,
    artist, title,
    duration: Math.round(parseInt(media.duration / 1000, 10)),
    thumbnail: media.artwork_url || media.user.avatar_url,
    restricted: []
  };
}

export default function soundCloudSource(uw, opts = {}) {
  const params = { client_id: opts.key };

  async function get(sourceIDs) {
    const [response] = await request('/tracks', {
      qs: {
        ...params,
        ids: sourceIDs.join(',')
      }
    });

    // Ensure the results order is the same as the sourceIDs parameter order.
    // TODO deal with nonexistant source IDs
    const items = {};
    response.body.forEach(sound => {
      const item = normalizeMedia(sound);
      items[item.sourceID] = item;
    });
    return sourceIDs.map(id => items[id]);
  }

  async function search(query, offset = 0) {
    const [response] = await request('/tracks', {
      qs: {
        ...params,
        offset,
        q: query,
        limit: PAGE_SIZE
      }
    });

    return response.body.map(normalizeMedia);
  }

  return {
    search,
    get: get // eslint-disable-line object-shorthand
  };
}
