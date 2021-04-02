'use strict';

const assert = require('assert');
const supertest = require('supertest');
const sinon = require('sinon');
const ms = require('ms');
const createUwave = require('./utils/createUwave');

describe('Bans', () => {
  let user;
  let uw;
  beforeEach(async () => {
    uw = await createUwave('bans');
    user = await uw.test.createUser();
  });
  afterEach(async () => {
    await uw.destroy();
  });

  describe('isBanned(user)', () => {
    it('returns false for unbanned users', async () => {
      assert.strictEqual(await uw.bans.isBanned(user.id), false);
    });
    it('returns true for banned users', async () => {
      user.banned = {
        duration: 1000,
        expiresAt: Date.now() + 1000,
      };
      await user.save();
      assert.strictEqual(await uw.bans.isBanned(user.id), true);
    });
  });

  describe('ban() and unban()', () => {
    it('can ban and unban a user', async () => {
      const moderator = await uw.test.createUser();
      assert.strictEqual(await uw.bans.isBanned(user.id), false);
      await uw.bans.ban(user, {
        moderator,
        duration: ms('10 hours'),
      });
      assert.strictEqual(await uw.bans.isBanned(user.id), true);

      await uw.bans.unban(user, { moderator });
      assert.strictEqual(await uw.bans.isBanned(user.id), false);
    });
  });

  describe('GET /bans', () => {
    it('requires authentication', async () => {
      await supertest(uw.server)
        .get('/api/bans')
        .expect(401);
    });

    it('requires the users.bans.list role', async () => {
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .get('/api/bans')
        .set('Cookie', `uwsession=${token}`)
        .expect(403);

      await uw.acl.allow(user, ['users.bans.list']);

      await supertest(uw.server)
        .get('/api/bans')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);
    });

    it('returns bans', async () => {
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.allow(user, ['users.bans.list', 'users.bans.add']);

      const bannedUser = await uw.test.createUser();
      await uw.bans.ban(bannedUser, {
        moderator: user,
        duration: ms('10 hours'),
        reason: 'just to test',
      });

      const res = await supertest(uw.server)
        .get('/api/bans')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      assert.strictEqual(res.body.meta.results, 1);
      sinon.assert.match(res.body.data[0], {
        duration: 36000000,
        expiresAt: sinon.match.string,
        reason: 'just to test',
        moderator: user.id,
        user: bannedUser.id,
      });
    });
  });
});
