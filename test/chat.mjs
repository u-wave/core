import assert from 'assert';
import sinon from 'sinon';
import delay from 'delay';
import supertest from 'supertest';
import createUwave from './utils/createUwave.mjs';

const sandbox = sinon.createSandbox();

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

// Can't get this to be reliable, skip for now
describe('Chat', () => {
  let uw;

  beforeEach(async () => {
    uw = await createUwave('chat');
  });
  afterEach(async () => {
    sandbox.restore();
    await uw.destroy();
  });

  it('can send chat messages through WebSockets', async () => {
    const user = await uw.test.createUser();

    const ws = await uw.test.connectToWebSocketAs(user);

    const receivedMessages = [];
    ws.on('message', (data) => {
      console.log('received', data + '');
      receivedMessages.push(JSON.parse(data));
    });

    ws.send(JSON.stringify({ command: 'sendChat', data: 'Message text' }));
    console.log('waiting');
    await waitFor(() => (
      receivedMessages.some((message) => (
        message.command === 'chatMessage'
        && message.data.userID === user.id
        && message.data.message === 'Message text'
      ))
    ), 15_000);
  });

  it('does not broadcast chat messages from muted users', async () => {
    const user = await uw.test.createUser();
    const mutedUser = await uw.test.createUser();

    const stub = sandbox.stub(uw.chat, 'isMuted');
    stub.withArgs(sinon.match({ id: user.id })).resolves(false);
    stub.withArgs(sinon.match({ id: mutedUser.id })).resolves(true);

    const ws = await uw.test.connectToWebSocketAs(user);
    const mutedWs = await uw.test.connectToWebSocketAs(mutedUser);

    const receivedMessages = [];
    ws.on('message', (data) => {
      receivedMessages.push(JSON.parse(data));
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
