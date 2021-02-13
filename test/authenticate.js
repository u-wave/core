'use strict';

const assert = require('assert');
const sinon = require('sinon');
const supertest = require('supertest');
const createUwave = require('./utils/createUwave');

const sandbox = sinon.createSandbox();

describe('Authentication', () => {
  let uw;

  beforeEach(async () => {
    uw = await createUwave('auth');
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
        from: 'sender@example.com',
        subject: 'Custom Subject',
        text: 'Text body',
        html: '<b>HTML body</b>',
      },
    });
  });
});
