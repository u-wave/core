import assert from 'assert';
import supertest from 'supertest';
import * as sinon from 'sinon';
import createUwave from './utils/createUwave.mjs';

describe('Runtime Config', () => {
  let user;
  let uw;
  beforeEach(async () => {
    uw = await createUwave('bans');
    user = await uw.test.createUser();
  });
  afterEach(async () => {
    await uw.destroy();
  });

  describe('GET /server/config', () => {
    it('requires authentication', async () => {
      await supertest(uw.server)
        .get('/api/server/config')
        .expect(401);
    });

    it('requires the super permission', async () => {
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.createRole('super', ['*']);

      await supertest(uw.server)
        .get('/api/server/config')
        .set('Cookie', `uwsession=${token}`)
        .expect(403);

      await uw.acl.allow(user, ['super']);

      await supertest(uw.server)
        .get('/api/server/config')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);
    });

    it('returns configuration', async () => {
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.allow(user, ['admin']);

      const res = await supertest(uw.server)
        .get('/api/server/config')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      // Just check that a couple of defaults exist
      sinon.assert.match(res.body.data, {
        'u-wave:motd': {},
        'u-wave:waitlist': {},
      });
      sinon.assert.match(res.body.meta, { schema: undefined });
    });

    it('includes schema if requested', async () => {
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.allow(user, ['admin']);

      const res = await supertest(uw.server)
        .get('/api/server/config?schema')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      // Just check that a couple of defaults exist
      sinon.assert.match(res.body.data, {
        'u-wave:motd': {},
        'u-wave:waitlist': {},
      });
      sinon.assert.match(res.body.meta, {
        schema: sinon.match({
          type: 'object',
        }),
      });
    });
  });

  describe('GET /server/config/:key', () => {
    it('requires authentication', async () => {
      await supertest(uw.server)
        .get('/api/server/config/u-wave:motd')
        .expect(401);
    });

    it('requires the super permission', async () => {
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.createRole('super', ['*']);

      await supertest(uw.server)
        .get('/api/server/config/u-wave:motd')
        .set('Cookie', `uwsession=${token}`)
        .expect(403);

      await uw.acl.allow(user, ['super']);

      await supertest(uw.server)
        .get('/api/server/config/u-wave:motd')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);
    });

    it('returns configuration', async () => {
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.allow(user, ['admin']);

      const res = await supertest(uw.server)
        .get('/api/server/config/u-wave:motd')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      sinon.assert.match(res.body.data, {});
    });

    it('rejects non-existent keys', async () => {
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.allow(user, ['admin']);

      await supertest(uw.server)
        .get('/api/server/config/something-fake')
        .set('Cookie', `uwsession=${token}`)
        .expect(404);

      await supertest(uw.server)
        .get('/api/server/config/hasOwnProperty')
        .set('Cookie', `uwsession=${token}`)
        .expect(404);
    });

    it('includes schema if requested', async () => {
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.allow(user, ['admin']);

      const res = await supertest(uw.server)
        .get('/api/server/config/u-wave:motd?schema')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      sinon.assert.match(res.body.meta, {
        schema: sinon.match({
          type: 'object',
          properties: {
            text: { type: 'string', nullable: true },
          },
        }),
      });
    });
  });

  describe('PUT /server/config/:key', () => {
    it('requires authentication', async () => {
      await supertest(uw.server)
        .put('/api/server/config/u-wave:motd')
        .expect(401);
    });

    it('requires the super permission', async () => {
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.createRole('super', ['*']);

      await supertest(uw.server)
        .put('/api/server/config/u-wave:motd')
        .set('Cookie', `uwsession=${token}`)
        .expect(403);

      await uw.acl.allow(user, ['super']);

      await supertest(uw.server)
        .put('/api/server/config/u-wave:motd')
        .set('Cookie', `uwsession=${token}`)
        .send({})
        .expect(200);
    });

    it('validates according to schema', async () => {
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.allow(user, ['admin']);

      await supertest(uw.server)
        .put('/api/server/config/u-wave:motd')
        .set('Cookie', `uwsession=${token}`)
        .send({ text: 'new motd' })
        .expect(200);

      const res = await supertest(uw.server)
        .get('/api/server/config/u-wave:motd')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      sinon.assert.match(res.body.data, {
        text: 'new motd',
      });
    });

    it('validates according to schema', async () => {
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.allow(user, ['admin']);

      await supertest(uw.server)
        .put('/api/server/config/u-wave:motd')
        .set('Cookie', `uwsession=${token}`)
        .send({ text: 1 })
        .expect(400);

      // Extraneous properties are allowed I guess
      const res = await supertest(uw.server)
        .put('/api/server/config/u-wave:motd')
        .set('Cookie', `uwsession=${token}`)
        .send({ somethingElse: 'motd' })
        .expect(200);
      // Make sure it didn't add the unknown property
      assert.deepStrictEqual(res.body.data, {});
    });

    it('rejects non-existent keys', async () => {
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.allow(user, ['admin']);

      await supertest(uw.server)
        .put('/api/server/config/something-fake')
        .set('Cookie', `uwsession=${token}`)
        .send({})
        .expect(404);

      await supertest(uw.server)
        .put('/api/server/config/hasOwnProperty')
        .set('Cookie', `uwsession=${token}`)
        .send({})
        .expect(404);
    });
  });
});
