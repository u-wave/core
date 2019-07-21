import { createServer } from 'http';
import { expect } from 'chai';
import ms from 'ms';
import mongoose from 'mongoose';
import uwave from '../src';
import usersPlugin from '../src/plugins/users';
import bansPlugin from '../src/plugins/bans';
import createUser from './utils/createUser';
import mongoConnected from './utils/mongoConnected';

const DB_NAME = 'uw_test_bans';

function createUwaveWithBansTest() {
  const server = createServer();
  const uw = uwave({
    useDefaultPlugins: false,
    mongo: mongoose.createConnection(`mongodb://localhost/${DB_NAME}`),
    secret: Buffer.from(`secret_${DB_NAME}`),
    server,
  });
  uw.use(usersPlugin());
  uw.use(bansPlugin());
  uw.on('stop', () => {
    server.close();
  });
  return uw;
}

describe('bans', () => {
  let user;
  let uw;
  let bans;
  beforeEach(async () => {
    uw = await createUwaveWithBansTest();
    bans = uw.bans; // eslint-disable-line prefer-destructuring
    user = createUser(uw);
    await user.save();
  });
  afterEach(async () => {
    await mongoConnected(uw.mongo);
    await uw.mongo.dropDatabase();
    await uw.stop();
  });

  describe('isBanned(user)', () => {
    it('returns false for unbanned users', async () => {
      expect(await bans.isBanned(user.id)).to.equal(false);
    });
    it('returns true for banned users', async () => {
      await user.update({
        banned: { expiresAt: Date.now() + 1000 },
      });
      expect(await bans.isBanned(user.id)).to.equal(true);
    });
  });

  describe('ban() and unban()', () => {
    it('can ban and unban a user', async () => {
      const moderator = createUser(uw);
      await moderator.save();
      expect(await bans.isBanned(user.id)).to.equal(false);
      await bans.ban(user, {
        moderator,
        duration: ms('10 hours'),
      });
      expect(await bans.isBanned(user.id)).to.equal(true);

      await bans.unban(user, { moderator });
      expect(await bans.isBanned(user.id)).to.equal(false);
    });
  });
});
