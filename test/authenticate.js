'use strict';

const assert = require('assert');
const delay = require('delay');
const sinon = require('sinon');
const supertest = require('supertest');
const createUwave = require('./utils/createUwave');
const createUser = require('./utils/createUser');

describe('Authentication', () => {
  let uw;

  beforeEach(async () => {
    uw = await createUwave('auth');
  });
  afterEach(async () => {
    await delay(500);
    await uw.destroy();
  });

  describe('GET /auth', () => {
    it('returns null when not authenticated', async () => {
      const res = await supertest(uw.server)
        .get('/api/auth')
        .expect(200);
      assert.strictEqual(res.body.data, null);
    });

    it('returns the current user object when authenticated', async () => {
      const user = await createUser(uw);
      const token = await uw.createTestSessionToken(user);

      const res = await supertest(uw.server)
        .get('/api/auth')
        .set('cookie', `uwsession=${token}`)
        .expect(200);
      sinon.assert.match(res.body.data, {
        _id: user.id,
        username: user.username,
        avatar: user.avatar,
        slug: user.slug,
      });
    });
  });

  describe('GET /auth/strategies', () => {
    it('returns local by default', async () => {
      const res = await supertest(uw.server)
        .get('/api/auth/strategies')
        .expect(200);
      assert.deepStrictEqual(res.body.data, ['local']);
    });

    it('returns "google" if configured', async () => {
      await uw.config.set('u-wave:socialAuth', {
        google: {
          enabled: true,
          clientID: 'TEST ID',
          clientSecret: 'TEST SECRET',
        },
      });

      const res = await supertest(uw.server)
        .get('/api/auth/strategies')
        .expect(200);
      assert.deepStrictEqual(res.body.data, ['local', 'google']);
    });
  });
});
