import assert from 'assert';
import {
  describe, it, beforeEach, afterEach,
} from 'vitest';
import * as sinon from 'sinon';
import supertest from 'supertest';
import nock from 'nock';
import testKeys from 'recaptcha-test-keys';
import createUwave from './utils/createUwave.mjs';

const sandbox = sinon.createSandbox();
const TEST_PASSWORD = 'testtest';

describe('Authentication', () => {
  let uw;
  let recaptcha = {};

  beforeEach(async () => {
    recaptcha = {};
    uw = await createUwave('auth', { recaptcha });
  });
  afterEach(async () => {
    sandbox.restore();
    await uw.close();
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
        // TODO: sql avatars
        // avatar: user.avatar,
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

  describe('POST /auth', () => {
    it('validates inputs', async () => {
      await supertest(uw.server)
        .post('/api/auth/login')
        .expect(400)
        .expect((res) => sinon.assert.match(res.body.errors[0], { code: 'validation-error' }));

      await supertest(uw.server)
        .post('/api/auth/login')
        .send({})
        .expect(400)
        .expect((res) => sinon.assert.match(res.body.errors[0], { code: 'validation-error' }));
      await supertest(uw.server)
        .post('/api/auth/login')
        .send({ email: 'name@example.com' })
        .expect(400)
        .expect((res) => sinon.assert.match(res.body.errors[0], { code: 'validation-error' }));
      await supertest(uw.server)
        .post('/api/auth/login')
        .send({ email: ['not', 'a', 'string'], password: TEST_PASSWORD })
        .expect(400)
        .expect((res) => sinon.assert.match(res.body.errors[0], { code: 'validation-error' }));
      await supertest(uw.server)
        .post('/api/auth/login')
        .send({ email: 'name@example.com', password: ['not', 'a', 'string'] })
        .expect(400)
        .expect((res) => sinon.assert.match(res.body.errors[0], { code: 'validation-error' }));

      await supertest(uw.server)
        .post('/api/auth/login')
        .send({ email: 'name@example.com', password: TEST_PASSWORD })
        .expect(404)
        // this means the input validation passed ;)
        .expect((res) => sinon.assert.match(res.body.errors[0], { code: 'user-not-found' }));

      await supertest(uw.server)
        .post('/api/auth/login?session=other')
        .send({ email: 'name@example.com', password: TEST_PASSWORD })
        .expect(400)
        .expect((res) => sinon.assert.match(res.body.errors[0], { code: 'validation-error' }));
    });

    it('rejects incorrect password', async () => {
      // Create a user to log in as
      await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'name@example.com', username: 'name', password: TEST_PASSWORD })
        .expect(200);

      const res = await supertest(uw.server)
        .post('/api/auth/login?session=token')
        .send({ email: 'name@example.com', password: 'not the password' })
        .expect(400);
      sinon.assert.match(res.body.errors[0], { code: 'incorrect-password' });
    });

    it('accepts correct password', async () => {
      // Create a user to log in as
      await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'name@example.com', username: 'name', password: TEST_PASSWORD })
        .expect(200);

      const loginRes = await supertest(uw.server)
        .post('/api/auth/login?session=token')
        .send({ email: 'name@example.com', password: TEST_PASSWORD })
        .expect(200);

      const token = loginRes.body.meta.jwt;

      const authRes = await supertest(uw.server)
        .get('/api/auth')
        .set('cookie', `uwsession=${token}`)
        .expect(200);
      sinon.assert.match(authRes.body.data, { username: 'name' });
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
        .send({ email: 'name@example.com', username: 'name', password: TEST_PASSWORD })
        .expect(200);

      await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'name@example.com', name: 'something with spaces', password: TEST_PASSWORD })
        .expect(400);
    });

    it('creates a user', async () => {
      const res = await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'name@example.com', username: 'name', password: TEST_PASSWORD })
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
        .send({ email: 'name@example.com', username: '테스트네임', password: TEST_PASSWORD })
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
          password: TEST_PASSWORD,
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
          password: TEST_PASSWORD,
          grecaptcha: 'sample recaptcha challenge for test :)',
        })
        .expect(200);

      assert.strictEqual(goodRes.body.data.username, 'name');
      assert(scope.isDone());
    });

    it('gracefully rejects duplicate email', async () => {
      await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'name@example.com', username: 'name', password: TEST_PASSWORD })
        .expect(200);

      const res = await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'name@example.com', username: 'unique', password: TEST_PASSWORD })
        .expect(422);

      sinon.assert.match(res.body.errors[0], { code: 'invalid-email' });
    });

    it('gracefully rejects duplicate username', async () => {
      await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'name@example.com', username: 'name', password: TEST_PASSWORD })
        .expect(200);

      const res = await supertest(uw.server)
        .post('/api/auth/register')
        .send({ email: 'unique@example.com', username: 'name', password: TEST_PASSWORD })
        .expect(422);

      sinon.assert.match(res.body.errors[0], { code: 'invalid-username' });
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
      await uw.close();
      uw = undefined;
    }
  });

  it('validates input', async () => {
    uw = await createUwave('pw_reset');

    await supertest(uw.server)
      .post('/api/auth/password/reset')
      .send('email@example.com')
      .expect(400);

    await supertest(uw.server)
      .post('/api/auth/password/reset')
      .send({})
      .expect(400);
  });

  it('emails a password reset link', async () => {
    const sendSpy = sandbox.spy(mailTransport, 'send');
    uw = await createUwave('pw_reset', {
      mailTransport,
    });

    const user = await uw.test.createUser();

    await supertest(uw.server)
      .post('/api/auth/password/reset')
      .send({ email: user.email })
      .expect(200);

    sinon.assert.calledWithMatch(sendSpy, {
      data: {
        to: sinon.match(/@example.com$/),
        text: sinon.match(/http:\/\/127\.0\.0\.1:\d+\/reset\//),
      },
    });
  });

  it('uses a custom email body', async () => {
    const sendSpy = sandbox.spy(mailTransport, 'send');
    uw = await createUwave('pw_reset', {
      mailTransport,
      createPasswordResetEmail({ token }) {
        assert.strictEqual(typeof token, 'string');
        return {
          from: 'sender@example.com',
          subject: 'Custom Subject',
          text: 'Text body',
          html: '<b>HTML body</b>',
        };
      },
    });

    const user = await uw.test.createUser();

    await supertest(uw.server)
      .post('/api/auth/password/reset')
      .send({ email: user.email })
      .expect(200);

    sinon.assert.calledWithMatch(sendSpy, {
      data: {
        from: 'sender@example.com',
        subject: 'Custom Subject',
        text: 'Text body',
        html: '<b>HTML body</b>',
      },
    });
  });

  it('can change the password', async () => {
    let token;

    const mailTransport = {
      name: 'test',
      send(mail, callback) {
        token = mail.data.token;

        callback(null, {
          envelope: mail.message.getEnvelope(),
          messageId: mail.message.messageId(),
        });
      },
    };

    uw = await createUwave('pw_reset', {
      mailTransport,
      createPasswordResetEmail({ token }) {
        return { token };
      },
    });

    const user = await uw.test.createUser();

    await supertest(uw.server)
      .post('/api/auth/password/reset')
      .send({ email: user.email })
      .expect(200);

    assert(token != null, 'requesting should have populated token');

    await supertest(uw.server)
      .post(`/api/auth/password/reset/${token}`)
      .send({ password: 'newpassword' })
      .expect(200);

    // Make sure we cannot reuse the token
    await supertest(uw.server)
      .post(`/api/auth/password/reset/${token}`)
      .send({ password: 'CANNOTREUSE' })
      .expect(422);

    // Make sure we can use the new password
    await supertest(uw.server)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'newpassword' })
      .expect(200);
  });
});
