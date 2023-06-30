import assert from 'assert';
import sinon from 'sinon';
import supertest from 'supertest';
import nock from 'nock';
import testKeys from 'recaptcha-test-keys';
import createUwave from './utils/createUwave.mjs';

const sandbox = sinon.createSandbox();

describe('Authentication', () => {
  let uw;
  let recaptcha = {};

  beforeEach(async () => {
    recaptcha = {};
    uw = await createUwave('auth', { recaptcha });
  });
  afterEach(async () => {
    sandbox.restore();
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
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);

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
      const configPropagated = new Promise((resolve) => {
        const unsubscribe = uw.config.subscribe('u-wave:socialAuth', () => {
          unsubscribe();
          resolve();
        });
      });
      await uw.config.set('u-wave:socialAuth', {
        google: {
          enabled: true,
          clientID: 'TEST ID',
          clientSecret: 'TEST SECRET',
        },
      });
      await configPropagated;

      const res = await supertest(uw.server)
        .get('/api/auth/strategies')
        .expect(200);
      assert.deepStrictEqual(res.body.data, ['local', 'google']);
    });
  });

  describe('POST /auth/register', () => {
    it('validates inputs', async () => {
      await supertest(uw.server)
        .post('/api/auth/register')
        .expect(400);

      await supertest(uw.server)
        .post('/api/auth/register')
        .send({ username: 'name' })
        .expect(400);
      await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'name@example.com' })
        .expect(400);
      await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'name@example.com', username: 'name', password: 'testtest' })
        .expect(200);

      await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'name@example.com', name: 'something with spaces', password: 'testtest' })
        .expect(400);
    });

    it('creates a user', async () => {
      const res = await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'name@example.com', username: 'name', password: 'testtest' })
        .expect(200);

      sinon.assert.match(res.body.data, {
        _id: sinon.match.string,
        // Default avatar
        avatar: sinon.match(/^https:\/\/sigil\.u-wave\.net/),
        roles: ['user'],
        username: 'name',
        slug: 'name',
      });
    });

    it('slugifies names well', async () => {
      const res = await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'name@example.com', username: '테스트네임', password: 'testtest' })
        .expect(200);

      assert.strictEqual(res.body.data.slug, 'teseuteuneim');
    });

    it('checks recaptcha if set', async () => {
      Object.assign(recaptcha, testKeys);
      const badRes = await supertest(uw.server)
        .post('/api/auth/register')
        .send({
          email: 'name@example.com',
          username: 'name',
          password: 'testtest',
        })
        .expect(400);

      sinon.assert.match(badRes.body.errors[0], {
        status: 400,
        code: 'recaptcha-failed',
      });

      const scope = nock('https://www.google.com/')
        .post('/recaptcha/api/siteverify', {
          response: 'sample recaptcha challenge for test :)',
          secret: testKeys.secret,
        })
        .reply(200, { success: true });

      const goodRes = await supertest(uw.server)
        .post('/api/auth/register')
        .send({
          email: 'name@example.com',
          username: 'name',
          password: 'testtest',
          grecaptcha: 'sample recaptcha challenge for test :)',
        })
        .expect(200);

      assert.strictEqual(goodRes.body.data.username, 'name');
      assert(scope.isDone());
    });
  });
});

describe('Password Reset', () => {
  let uw;

  const mailTransport = {
    name: 'test',
    send(mail, callback) {
      callback(null, {
        envelope: mail.message.getEnvelope(),
        messageId: mail.message.messageId(),
      });
    },
  };

  afterEach(async () => {
    sandbox.restore();
    if (uw) {
      await uw.destroy();
      uw = undefined;
    }
  });

  it('emails a password reset link', async () => {
    const sendSpy = sandbox.spy(mailTransport, 'send');
    uw = await createUwave('pw_reset', {
      mailTransport,
    });

    const user = await uw.test.createUser();
    await uw.models.Authentication.create({
      email: 'test@example.com',
      user,
      hash: 'passwordhash',
    });

    await supertest(uw.server)
      .post('/api/auth/password/reset')
      .send({ email: 'test@example.com' })
      .expect(200);

    sinon.assert.calledWithMatch(sendSpy, {
      data: {
        to: 'test@example.com',
        from: sinon.match(/noreply@/),
        subject: 'üWave Password Reset Request',
        text: sinon.match(/http:\/\/127\.0\.0\.1:\d+\/reset\//),
        html: sinon.match(/http:\/\/127\.0\.0\.1:\d+\/reset\//),
      },
    });
  });
});
