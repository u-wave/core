import assert from 'assert';
import sinon from 'sinon';
import delay from 'delay';
import supertest from 'supertest';
import randomString from 'random-string';
import createUwave from './utils/createUwave.mjs';

const sandbox = sinon.createSandbox();
const skipOnCI = process.env.CI ? it.skip : it;

/**
 * @param {() => boolean} predicate
 * @param {number} timeout
 */
async function waitFor(predicate, timeout) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    await delay(10); // eslint-disable-line no-await-in-loop
    if (predicate()) {
      return;
    }
  }
  throw new Error('Timed out waiting for predicate');
}

describe('Chat', () => {
  let uw;

  beforeEach(async () => {
    uw = await createUwave('chat');
  });
  afterEach(async () => {
    sandbox.restore();
    await uw.destroy();
  });

  // Flaky on CI
  skipOnCI('can send chat messages through WebSockets', async () => {
    const user = await uw.test.createUser();

    const ws = await uw.test.connectToWebSocketAs(user);

    const receivedMessages = [];
    ws.on('message', (data) => {
      if (`${data}` === '-') return;
      receivedMessages.push(JSON.parse(`${data}`));
    });

    ws.send(JSON.stringify({ command: 'sendChat', data: 'Message text' }));
    // Using very long timeouts for CI
    await waitFor(() => (
      receivedMessages.some((message) => (
        message.command === 'chatMessage'
        && message.data.userID === user.id
        && message.data.message === 'Message text'
      ))
    ), 5_000);
  });

  // Flaky on CI
  skipOnCI('does not broadcast chat messages from muted users', async () => {
    const user = await uw.test.createUser();
    const mutedUser = await uw.test.createUser();

    const stub = sandbox.stub(uw.chat, 'isMuted');
    stub.withArgs(sinon.match({ id: user.id })).resolves(false);
    stub.withArgs(sinon.match({ id: mutedUser.id })).resolves(true);

    const ws = await uw.test.connectToWebSocketAs(user);
    const mutedWs = await uw.test.connectToWebSocketAs(mutedUser);

    const receivedMessages = [];
    ws.on('message', (data) => {
      if (`${data}` === '-') return;
      receivedMessages.push(JSON.parse(`${data}`));
    });

    ws.send(JSON.stringify({ command: 'sendChat', data: 'unmuted' }));
    mutedWs.send(JSON.stringify({ command: 'sendChat', data: 'muted' }));

    await waitFor(() => receivedMessages.length >= 2, 5_000);

    assert(receivedMessages.some((message) => message.command === 'chatMessage' && message.data.userID === user.id));
    assert(!receivedMessages.some((message) => message.command === 'chatMessage' && message.data.userID === mutedUser.id));
  });

  describe('POST /chat', () => {
    it('requires authentication', async () => {
      await supertest(uw.server)
        .post('/api/chat')
        .send({ message: 'blah' })
        .expect(401);
    });

    it('validates input', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({ not: 'a message' })
        .expect(400);

      await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send('text')
        .expect(400);

      await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({ message: null })
        .expect(400);

      await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({ message: '' })
        .expect(400);
    });

    it('validates tags', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({ message: 'a message', tags: null })
        .expect(400);

      await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({ message: 'a message', tags: {} })
        .expect(200);

      await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({ message: 'a message', tags: { replyTo: 2 } })
        .expect(400);

      await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({ message: 'a message', tags: { id: 1 } })
        .expect(400);

      await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({
          message: 'a message',
          tags: {
            id: '9e32b0f7-889b-40b3-b59b-60ed06a07890',
            replyTo: '60bbdb3a-d9c3-42a8-be27-eb2574ad0ed4',
          },
        })
        .expect(200);

      const res = await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({ message: 'a message', tags: { unknown: '' } })
        .expect(200);
      assert.deepStrictEqual(res.body.data.tags, {}, 'Unknown tags removed');

      const aLotOfTags = {};
      for (let i = 0; i < 20; i += 1) {
        aLotOfTags[`test:${randomString({ length: 16 })}`] = randomString({ length: 200 });
      }

      await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({ message: 'a message', tags: aLotOfTags })
        // TODO This should return 400 when namespaced tags are supported.
        .expect(200);
    });

    it('broadcasts a chat message', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);
      const ws = await uw.test.connectToWebSocketAs(user);

      const res = await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({ message: 'HTTP message text' })
        .expect(200);
      sinon.assert.match(res.body.data, {
        _id: sinon.match.string,
        message: sinon.match.string,
        tags: {},
      });

      const receivedMessages = [];
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data));
      });

      ws.send(JSON.stringify({ command: 'sendChat', data: 'HTTP message text' }));
      await waitFor(() => (
        receivedMessages.some((message) => (
          message.command === 'chatMessage'
          && message.data.userID === user.id
          && message.data.message === 'HTTP message text'
        ))
      ), 5_000);
    });
  });
});
