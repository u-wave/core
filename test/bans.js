const assert = require('assert');
const ms = require('ms');
const uwave = require('..');
const usersPlugin = require('../src/plugins/users');
const bansPlugin = require('../src/plugins/bans');
const createUser = require('./utils/createUser');
const deleteDatabase = require('./utils/deleteDatabase');

const DB_NAME = 'uw_test_bans';

function createUwaveWithBansTest() {
  const uw = uwave({
    useDefaultPlugins: false,
    mongo: `mongodb://localhost/${DB_NAME}`,
    secret: Buffer.from(`secret_${DB_NAME}`),
  });
  uw.use(usersPlugin());
  uw.use(bansPlugin());
  return uw;
}

describe('bans', () => {
  let user;
  let uw;
  let bans;
  beforeEach(async () => {
    uw = await createUwaveWithBansTest();
    await uw.ready;
    bans = uw.bans; // eslint-disable-line prefer-destructuring
    user = createUser(uw);
    await user.save();
  });
  afterEach(async () => {
    await uw.stop();
    await deleteDatabase(uw.options.mongo);
  });

  describe('isBanned(user)', () => {
    it('returns false for unbanned users', async () => {
      assert.strictEqual(await bans.isBanned(user.id), false);
    });
    it('returns true for banned users', async () => {
      user.banned = {
        duration: 1000,
        expiresAt: Date.now() + 1000,
      };
      await user.save();
      assert.strictEqual(await bans.isBanned(user.id), true);
    });
  });

  describe('ban() and unban()', () => {
    it('can ban and unban a user', async () => {
      const moderator = createUser(uw);
      await moderator.save();
      assert.strictEqual(await bans.isBanned(user.id), false);
      await bans.ban(user, {
        moderator,
        duration: ms('10 hours'),
      });
      assert.strictEqual(await bans.isBanned(user.id), true);

      await bans.unban(user, { moderator });
      assert.strictEqual(await bans.isBanned(user.id), false);
    });
  });
});
