'use strict';

const assert = require('assert');
const ms = require('ms');
const createUser = require('./utils/createUser');
const createUwave = require('./utils/createUwave');

describe('Bans', () => {
  let user;
  let uw;
  beforeEach(async () => {
    uw = await createUwave('bans');
    user = await createUser(uw);
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
      const moderator = await createUser(uw);
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
});
