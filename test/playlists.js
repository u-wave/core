'use strict';

const assert = require('assert');
const { inspect } = require('util');
const supertest = require('supertest');
const sinon = require('sinon');
const randomString = require('random-string');
const createUwave = require('./utils/createUwave');

function assertItemsAndIncludedMedia(body) {
  for (const item of body.data) {
    sinon.assert.match(item, {
      artist: sinon.match.string,
      title: sinon.match.string,
      start: sinon.match.number,
      end: sinon.match.number,
      media: sinon.match.string,
    });

    assert(
      body.included.media.find((includedMedia) => includedMedia._id === item.media),
      `missing media referenced by item ${inspect(item)}`,
    );
  }
}

describe('Playlists', () => {
  let user;
  let uw;

  async function generateItems(size) {
    const itemIDs = [];
    for (let i = 0; i < size; i += 1) {
      itemIDs.push(randomString(6));
    }
    const items = await uw.source('test-source').get(user, itemIDs);
    return items;
  }

  beforeEach(async () => {
    uw = await createUwave('acl');
    user = await uw.test.createUser();

    uw.source({
      name: 'test-source',
      api: 2,
      async get(context, ids) {
        return ids.map((id) => ({
          sourceID: id,
          artist: `artist ${id}`,
          title: `title ${id}`,
          start: 0,
          end: 60,
        }));
      },
      async search() {
        throw new Error('unimplemented');
      },
    });
  });
  afterEach(async () => {
    await uw.destroy();
  });

  describe('GET /playlists', () => {
    it('requires authentication', async () => {
      await supertest(uw.server)
        .get('/api/playlists')
        .expect(401);
    });

    it('shows all playlists for a user', async () => {
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'Playlist A' })
        .expect(200);
      await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'Playlist B' })
        .expect(200);

      const res = await supertest(uw.server)
        .get('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      sinon.assert.match(res.body.data, [
        sinon.match({ name: 'Playlist A' }),
        sinon.match({ name: 'Playlist B' }),
      ]);
    });
  });

  describe('POST /playlists', () => {
    it('requires authentication', async () => {
      await supertest(uw.server)
        .post('/api/playlists')
        .expect(401);
    });

    it('validates input', async () => {
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({})
        .expect(400);

      await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 1 })
        .expect(400);

      await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({ name: '' })
        .expect(400);

      await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'New Playlist' })
        .expect(200);
    });

    it('creates a playlist', async () => {
      const token = await uw.test.createTestSessionToken(user);

      const res = await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'New Playlist' })
        .expect(200);

      sinon.assert.match(res.body.data, {
        name: 'New Playlist',
        author: user.id,
        size: 0,
      });
    });

    it('activates a new user\'s first playlist', async () => {
      const token = await uw.test.createTestSessionToken(user);

      const res = await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'First Playlist' })
        .expect(200);

      sinon.assert.match(res.body.meta, {
        active: true,
      });

      const secondRes = await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'Second Playlist' })
        .expect(200);

      sinon.assert.match(secondRes.body.meta, {
        active: false,
      });

      const userData = await supertest(uw.server)
        .get('/api/auth')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      sinon.assert.match(userData.body.data, {
        activePlaylist: res.body.data._id,
      });
    });
  });

  describe('PATCH /playlists/:id', () => {
    it('requires authentication', async () => {
      const fakeID = '603e43b12d46ab05a8946a23';

      await supertest(uw.server)
        .patch(`/api/playlists/${fakeID}`)
        .expect(401);
    });

    it('validates input', async () => {
      const fakeID = '603e43b12d46ab05a8946a23';
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .patch(`/api/playlists/${fakeID}`)
        .set('Cookie', `uwsession=${token}`)
        .send({ someGarbage: null })
        .expect(400);

      await supertest(uw.server)
        .patch(`/api/playlists/${fakeID}`)
        .set('Cookie', `uwsession=${token}`)
        .send({ name: '' })
        .expect(400);

      await supertest(uw.server)
        .patch(`/api/playlists/${fakeID}`)
        .set('Cookie', `uwsession=${token}`)
        .send({ name: [] })
        .expect(400);

      await supertest(uw.server)
        .patch(`/api/playlists/${fakeID}`)
        .set('Cookie', `uwsession=${token}`)
        .send({ description: [] })
        .expect(400);

      await supertest(uw.server)
        .patch(`/api/playlists/${fakeID}`)
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'not found' })
        .expect(404);
    });

    it('changes the name of the playlist', async () => {
      const token = await uw.test.createTestSessionToken(user);

      const create = await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'First Playlist' })
        .expect(200);

      const id = create.body.data._id;

      const renamed = await supertest(uw.server)
        .patch(`/api/playlists/${id}`)
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'New Name' })
        .expect(200);

      sinon.assert.match(renamed.body.data, {
        name: 'New Name',
      });

      const persisted = await supertest(uw.server)
        .get(`/api/playlists/${id}`)
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      sinon.assert.match(persisted.body.data, {
        name: 'New Name',
      });
    });
  });

  describe('PUT /playlists/:id/rename', () => {
    it('requires authentication', async () => {
      const fakeID = '603e43b12d46ab05a8946a23';

      await supertest(uw.server)
        .put(`/api/playlists/${fakeID}/rename`)
        .expect(401);
    });

    it('validates input', async () => {
      const fakeID = '603e43b12d46ab05a8946a23';
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .put(`/api/playlists/${fakeID}/rename`)
        .set('Cookie', `uwsession=${token}`)
        .send({})
        .expect(400);

      await supertest(uw.server)
        .put(`/api/playlists/${fakeID}/rename`)
        .set('Cookie', `uwsession=${token}`)
        .send({ name: '' })
        .expect(400);

      await supertest(uw.server)
        .put(`/api/playlists/${fakeID}/rename`)
        .set('Cookie', `uwsession=${token}`)
        .send({ name: [] })
        .expect(400);

      await supertest(uw.server)
        .put(`/api/playlists/${fakeID}/rename`)
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'not found' })
        .expect(404);
    });

    it('changes the name of the playlist', async () => {
      const token = await uw.test.createTestSessionToken(user);

      const create = await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'First Playlist' })
        .expect(200);

      const id = create.body.data._id;

      const renamed = await supertest(uw.server)
        .put(`/api/playlists/${id}/rename`)
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'New Name' })
        .expect(200);

      sinon.assert.match(renamed.body.data, {
        name: 'New Name',
      });

      const persisted = await supertest(uw.server)
        .get(`/api/playlists/${id}`)
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      sinon.assert.match(persisted.body.data, {
        name: 'New Name',
      });
    });
  });

  describe('PUT /playlists/:id/activate', () => {
    it('requires authentication', async () => {
      const fakeID = '603e43b12d46ab05a8946a23';

      await supertest(uw.server)
        .put(`/api/playlists/${fakeID}/activate`)
        .expect(401);
    });

    it('activates the playlist', async () => {
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'First Playlist' })
        .expect(200);

      const secondPlaylist = await supertest(uw.server)
        .post('/api/playlists')
        .set('Cookie', `uwsession=${token}`)
        .send({ name: 'Second Playlist' })
        .expect(200);

      await supertest(uw.server)
        .put(`/api/playlists/${secondPlaylist.body.data._id}/activate`)
        .set('Cookie', `uwsession=${token}`)
        .send()
        .expect(200);

      const activePlaylist = await supertest(uw.server)
        .get('/api/auth')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      sinon.assert.match(activePlaylist.body.data, {
        activePlaylist: secondPlaylist.body.data._id,
      });
    });
  });

  describe('GET /playlists/:id/media', () => {
    let playlist;
    beforeEach(async () => {
      playlist = await uw.playlists.createPlaylist(user, { name: 'Test Playlist' });
      const items = await generateItems(200);
      await uw.playlists.addPlaylistItems(playlist, items);
    });

    it('requires authentication', async () => {
      await supertest(uw.server)
        .get(`/api/playlists/${playlist.id}/media`)
        .expect(401);
    });

    it('returns Not Found for other people\'s playlists', async () => {
      const otherUser = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(otherUser);

      await supertest(uw.server)
        .get(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .expect(404);
    });

    it('returns playlist items', async () => {
      const token = await uw.test.createTestSessionToken(user);

      const res = await supertest(uw.server)
        .get(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send()
        .expect(200);

      sinon.assert.match(res.body, {
        meta: {
          included: {
            media: ['media'],
          },
          // Default page size
          offset: 0,
          pageSize: 100,
          // Playlist size
          total: 200,
        },
      });
      assert.strictEqual(res.body.data.length, 100);

      assertItemsAndIncludedMedia(res.body);
    });

    it('paginates', async () => {
      const token = await uw.test.createTestSessionToken(user);

      const page4 = await supertest(uw.server)
        .get(`/api/playlists/${playlist.id}/media?page[offset]=40&page[limit]=10`)
        .set('Cookie', `uwsession=${token}`)
        .send()
        .expect(200);

      const page5 = await supertest(uw.server)
        .get(`/api/playlists/${playlist.id}/media?page[offset]=50&page[limit]=10`)
        .set('Cookie', `uwsession=${token}`)
        .send()
        .expect(200);

      sinon.assert.match(page4.body.meta, { offset: 40, pageSize: 10 });
      sinon.assert.match(page5.body.meta, { offset: 50, pageSize: 10 });
      assert.strictEqual(page4.body.data.length, 10);
      assert.strictEqual(page5.body.data.length, 10);

      assert.notDeepStrictEqual(page4.body.data, page5.body.data, 'should return different items');

      assertItemsAndIncludedMedia(page4.body);
      assertItemsAndIncludedMedia(page5.body);
    });
  });

  describe('POST /playlists/:id/media', () => {
    let playlist;
    beforeEach(async () => {
      playlist = await uw.playlists.createPlaylist(user, { name: 'Test Playlist' });
    });

    it('requires authentication', async () => {
      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .expect(401);
    });

    it('validates input', async () => {
      const token = await uw.test.createTestSessionToken(user);

      // `items` must be an array
      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: { not: 'an array' }, at: 'start' })
        .expect(400);

      // `items` must have the right shape
      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [{ __proto__: {} }], at: 'start' })
        .expect(400);

      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [{ sourceType: 'garbage', noSourceID: '' }], at: 'start' })
        .expect(400);

      // `after` must be a string
      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], after: 0 })
        .expect(400);

      // `after` can be -1 to support old clients
      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], after: -1 })
        .expect(200);

      // `after: null` is the same as `at: 'start'`
      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], after: null })
        .expect(200);

      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], at: 'start' })
        .expect(200);

      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], at: 'end' })
        .expect(200);

      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], at: 'middle' })
        .expect(400);
    });

    it('returns Not Found for other people\'s playlists', async () => {
      const otherUser = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(otherUser);

      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], at: 'start' })
        .expect(404);
    });

    it('adds items at the start', async () => {
      const token = await uw.test.createTestSessionToken(user);

      const firstItems = await generateItems(20);
      const res = await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: firstItems, at: 'start' })
        .expect(200);

      sinon.assert.match(res.body.meta, {
        afterID: null,
        playlistSize: 20,
      });
      assert.strictEqual(res.body.data.length, 20, 'returns the newly added items');
      assertItemsAndIncludedMedia(res.body);

      const secondItems = await generateItems(20);
      const res2 = await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: secondItems, after: null })
        .expect(200);

      sinon.assert.match(res2.body.meta, {
        afterID: null,
        playlistSize: 40,
      });
      assert.strictEqual(res2.body.data.length, 20, 'returns the newly added items');
      assertItemsAndIncludedMedia(res2.body);
    });

    it('inserts items `after` an existing item', async () => {
      const initialItems = await generateItems(20);
      const { added } = await uw.playlists.addPlaylistItems(playlist, initialItems, { at: 'start' });

      const token = await uw.test.createTestSessionToken(user);

      const middleItem = added[9];
      const insertItems = await generateItems(5);
      const res2 = await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: insertItems, after: middleItem._id })
        .expect(200);

      sinon.assert.match(res2.body.meta, {
        afterID: middleItem.id,
        playlistSize: 25,
      });
      assert.strictEqual(res2.body.data.length, 5, 'returns the newly added items');
      assertItemsAndIncludedMedia(res2.body);
    });
  });

  describe('PUT /playlists/:id/move', () => {
    let playlist;
    let playlistItems;
    beforeEach(async () => {
      playlist = await uw.playlists.createPlaylist(user, { name: 'Test Playlist' });
      const insertItems = await generateItems(20);
      const { added } = await uw.playlists.addPlaylistItems(playlist, insertItems, { at: 'start' });
      playlistItems = added;
    });

    it('requires authentication', async () => {
      await supertest(uw.server)
        .put(`/api/playlists/${playlist.id}/move`)
        .expect(401);
    });

    it('validates input', async () => {
      const token = await uw.test.createTestSessionToken(user);

      // `items` must be an array of object IDs
      await supertest(uw.server)
        .put(`/api/playlists/${playlist.id}/move`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: { not: 'an array' }, at: 'start' })
        .expect(400);

      await supertest(uw.server)
        .put(`/api/playlists/${playlist.id}/move`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [{ sourceType: 'garbage', noSourceID: '' }], at: 'start' })
        .expect(400);

      await supertest(uw.server)
        .put(`/api/playlists/${playlist.id}/move`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [playlistItems[1].id], at: 'start' })
        .expect(200);

      // `after` must be a string
      await supertest(uw.server)
        .put(`/api/playlists/${playlist.id}/move`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], after: 0 })
        .expect(400);

      // `after` can be -1 to support old clients
      await supertest(uw.server)
        .put(`/api/playlists/${playlist.id}/move`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], after: -1 })
        .expect(200);

      // `after: null` is the same as `at: 'start'`
      await supertest(uw.server)
        .put(`/api/playlists/${playlist.id}/move`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], after: null })
        .expect(200);

      await supertest(uw.server)
        .put(`/api/playlists/${playlist.id}/move`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], at: 'start' })
        .expect(200);

      await supertest(uw.server)
        .put(`/api/playlists/${playlist.id}/move`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], at: 'end' })
        .expect(200);

      await supertest(uw.server)
        .put(`/api/playlists/${playlist.id}/move`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], at: 'middle' })
        .expect(400);
    });

    it('returns Not Found for other people\'s playlists', async () => {
      const otherUser = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(otherUser);

      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/move`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [], at: 'start' })
        .expect(404);
    });

    it('moves items to the start', async () => {
      const token = await uw.test.createTestSessionToken(user);

      const itemsToMove = playlistItems.slice(5, 10).map((item) => item.id);

      await supertest(uw.server)
        .put(`/api/playlists/${playlist.id}/move`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: itemsToMove, at: 'start' })
        .expect(200);

      const res = await supertest(uw.server)
        .get(`/api/playlists/${playlist.id}/media?page[limit]=10`)
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      assertItemsAndIncludedMedia(res.body);

      const movedItems = res.body.data.slice(0, 5).map((item) => item._id);
      assert.deepStrictEqual(itemsToMove, movedItems);
    });

    it('ignores garbage item IDs', async () => {
      const token = await uw.test.createTestSessionToken(user);

      const realItems = playlistItems.slice(15).map((item) => item.id);
      const itemsToMove = [
        '604cee7e2d46ab05a8947ce2',
        ...realItems,
        '56fb09bd2268cb6678186df3',
      ];

      await supertest(uw.server)
        .put(`/api/playlists/${playlist.id}/move`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: itemsToMove, at: 'start' })
        .expect(200);

      const res = await supertest(uw.server)
        .get(`/api/playlists/${playlist.id}/media?page[limit]=10`)
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      assertItemsAndIncludedMedia(res.body);

      const movedItems = res.body.data.slice(0, 5).map((item) => item._id);
      assert.deepStrictEqual(realItems, movedItems);
    });
  });

  describe('POST /playlists/:id/shuffle', () => {
    let playlist;
    beforeEach(async () => {
      playlist = await uw.playlists.createPlaylist(user, { name: 'Test Playlist' });
      const insertItems = await generateItems(20);
      await uw.playlists.addPlaylistItems(playlist, insertItems, { at: 'start' });
    });

    it('requires authentication', async () => {
      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/shuffle`)
        .expect(401);
    });

    it('returns Not Found for other people\'s playlists', async () => {
      const otherUser = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(otherUser);

      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/shuffle`)
        .set('Cookie', `uwsession=${token}`)
        .expect(404);
    });

    it('does not crash', async () => {
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .post(`/api/playlists/${playlist.id}/shuffle`)
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      // We can't do much more to test this since the shuffle is random
    });
  });

  describe('DELETE /playlists/:id/media', () => {
    let playlist;
    let playlistItems;
    beforeEach(async () => {
      playlist = await uw.playlists.createPlaylist(user, { name: 'Test Playlist' });
      const insertItems = await generateItems(20);
      const { added } = await uw.playlists.addPlaylistItems(playlist, insertItems, { at: 'start' });
      playlistItems = added;
    });

    it('requires authentication', async () => {
      await supertest(uw.server)
        .delete(`/api/playlists/${playlist.id}/media`)
        .expect(401);
    });

    it('validates input', async () => {
      const token = await uw.test.createTestSessionToken(user);

      // `items` must be an array of object IDs
      await supertest(uw.server)
        .delete(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: { not: 'an array' } })
        .expect(400);

      await supertest(uw.server)
        .delete(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [{ not: 'an id' }] })
        .expect(400);

      await supertest(uw.server)
        .delete(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [playlistItems[1].id] })
        .expect(200);
    });

    it('returns Not Found for other people\'s playlists', async () => {
      const otherUser = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(otherUser);

      await supertest(uw.server)
        .delete(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: [] })
        .expect(404);
    });

    it('removes items', async () => {
      const token = await uw.test.createTestSessionToken(user);

      const itemsToRemove = playlistItems.slice(5, 10).map((item) => item.id);

      await supertest(uw.server)
        .delete(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: itemsToRemove })
        .expect(200);

      const res = await supertest(uw.server)
        .get(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      assert.strictEqual(res.body.meta.total, 15, 'should have fewer elements remaining');

      const remainingIDs = res.body.data.map((item) => item._id);
      assert(
        itemsToRemove.every((removedID) => !remainingIDs.includes(removedID)),
        'should not contain removed item IDs',
      );
    });

    it('ignores garbage item IDs', async () => {
      const token = await uw.test.createTestSessionToken(user);

      const realItems = playlistItems.slice(15).map((item) => item.id);
      const itemsToRemove = [
        '604cee7e2d46ab05a8947ce2',
        ...realItems,
        '56fb09bd2268cb6678186df3',
      ];

      await supertest(uw.server)
        .delete(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .send({ items: itemsToRemove })
        .expect(200);

      const res = await supertest(uw.server)
        .get(`/api/playlists/${playlist.id}/media`)
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      assert.strictEqual(res.body.meta.total, 15, 'should have fewer elements remaining');
    });
  });

  describe.skip('GET /playlists/:id/media/:itemID', () => {});
  describe.skip('PUT /playlists/:id/media/:itemID', () => {});
  describe.skip('DELETE /playlists/:id/media/:itemID', () => {});
});
