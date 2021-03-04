'use strict';

const supertest = require('supertest');
const sinon = require('sinon');
const createUwave = require('./utils/createUwave');

describe('Playlists', () => {
  let user;
  let uw;
  beforeEach(async () => {
    uw = await createUwave('acl');
    user = await uw.test.createUser();
  });
  afterEach(async () => {
    await uw.destroy();
  });

  describe('GET /playlists', () => {
    it('requires authentication', async () => {
      await supertest(uw.server)
        .get('/api/playlists')
        .expect(403);
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
        .expect(403);
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
        .expect(403);
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
        .expect(403);
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
        .expect(403);
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

  describe.skip('GET /playlists/:id/media', () => {});
  describe.skip('POST /playlists/:id/media', () => {});
  describe.skip('DELETE /playlists/:id/media', () => {});
  describe.skip('PUT /playlists/:id/move', () => {});
  describe.skip('POST /playlists/:id/shuffle', () => {});
  describe.skip('GET /playlists/:id/media/:itemID', () => {});
  describe.skip('PUT /playlists/:id/media/:itemID', () => {});
  describe.skip('DELETE /playlists/:id/media/:itemID', () => {});
});
