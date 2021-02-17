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
  });
});
