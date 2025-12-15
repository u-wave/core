import { randomUUID } from 'crypto';
import assert from 'assert';
import * as sinon from 'sinon';
import supertest from 'supertest';
import createUwave from './utils/createUwave.mjs';
import { retryFor } from './utils/retry.mjs';

const sandbox = sinon.createSandbox();

describe('Chat', () => {
  let uw;

  beforeEach(async () => {
    uw = await createUwave('chat');
  });
  afterEach(async () => {
    sandbox.restore();
    await uw.destroy();
  });

  it('can broadcast chat messages', async () => {
    const user = await uw.test.createUser();

    const ws = await uw.test.connectToWebSocketAs(user);

    const receivedMessages = [];
    ws.on('message', (data) => {
      receivedMessages.push(JSON.parse(data));
    });

    ws.send(JSON.stringify({ command: 'sendChat', data: 'Message text' }));

    await retryFor(1500, () => {
      assert(receivedMessages.some((message) => message.command === 'chatMessage' && message.data.userID === user.id && message.data.message === 'Message text'));
    });
  });

  it('does not broadcast chat messages from muted users', async () => {
    const user = await uw.test.createUser();
    const token = await uw.test.createTestSessionToken(user);
    await uw.acl.allow(user, ['admin']);
    const mutedUser = await uw.test.createUser();

    await supertest(uw.server)
      .post(`/api/users/${mutedUser.id}/mute`)
      .set('Cookie', `uwsession=${token}`)
      .send({ time: 60 /* seconds */ })
      .expect(200);

    const ws = await uw.test.connectToWebSocketAs(user);
    const mutedWs = await uw.test.connectToWebSocketAs(mutedUser);

    const receivedMessages = [];
    ws.on('message', (data) => {
      receivedMessages.push(JSON.parse(data));
    });

    ws.send(JSON.stringify({ command: 'sendChat', data: 'unmuted' }));
    mutedWs.send(JSON.stringify({ command: 'sendChat', data: 'muted' }));

    await retryFor(1500, () => {
      assert(receivedMessages.some((message) => message.command === 'chatMessage' && message.data.userID === user.id));
      assert(!receivedMessages.some((message) => message.command === 'chatMessage' && message.data.userID === mutedUser.id));
    });
  });

  describe('GET /chat', () => {
    it('responds', async () => {
      await supertest(uw.server)
        .get('/api/chat')
        .expect(200);
    });
  });

  describe('POST /chat', () => {
    it('requires authentication', async () => {
      await supertest(uw.server)
        .post('/api/chat')
        .send({ message: 'blah' })
        .expect(401);
    });

    it('requires the chat.send permission', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({ message: 'blah' })
        .expect(403);

      await uw.acl.createRole('chatSender', ['chat.send']);
      await uw.acl.allow(user, ['chatSender']);

      await supertest(uw.server)
        .post('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .send({ message: 'blah' })
        .expect(200);
    });

    it('validates input', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);

      await uw.acl.createRole('chatSender', ['chat.send']);
      await uw.acl.allow(user, ['chatSender']);

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

      await uw.acl.createRole('chatSender', ['chat.send']);
      await uw.acl.allow(user, ['chatSender']);

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
      await retryFor(5_000, () => (
        receivedMessages.some((message) => (
          message.command === 'chatMessage'
          && message.data.userID === user.id
          && message.data.message === 'HTTP message text'
        ))
      ));
    });
  });

  describe('DELETE /chat/', () => {
    it('requires authentication', async () => {
      await supertest(uw.server)
        .delete('/api/chat')
        .expect(401);
    });

    it('requires the chat.delete permission', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .delete('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .expect(403);

      await uw.acl.createRole('chatDeleter', ['chat.delete']);
      await uw.acl.allow(user, ['chatDeleter']);

      await supertest(uw.server)
        .delete('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);
    });

    it('broadcasts delete messages', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.createRole('chatDeleter', ['chat.delete']);
      await uw.acl.allow(user, ['chatDeleter']);

      const otherUser = await uw.test.createUser();
      const ws = await uw.test.connectToWebSocketAs(otherUser);

      const receivedMessages = [];
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data));
      });

      await supertest(uw.server)
        .delete('/api/chat')
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      await retryFor(1500, () => {
        sinon.assert.match(receivedMessages, sinon.match.some(sinon.match.has('command', 'chatDelete')));
      });
    });
  });

  describe('DELETE /chat/user/:id', () => {
    it('requires authentication', async () => {
      const user = await uw.test.createUser();

      await supertest(uw.server)
        .delete(`/api/chat/user/${user.id}`)
        .expect(401);
    });

    it('requires the chat.delete permission', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .delete(`/api/chat/user/${user.id}`)
        .set('Cookie', `uwsession=${token}`)
        .expect(403);

      await uw.acl.createRole('chatDeleter', ['chat.delete']);
      await uw.acl.allow(user, ['chatDeleter']);

      await supertest(uw.server)
        .delete(`/api/chat/user/${user.id}`)
        .set('Cookie', `uwsession=${token}`)
        .expect(200);
    });

    it('broadcasts delete messages', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.createRole('chatDeleter', ['chat.delete']);
      await uw.acl.allow(user, ['chatDeleter']);

      const otherUser = await uw.test.createUser();
      const ws = await uw.test.connectToWebSocketAs(otherUser);

      const receivedMessages = [];
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data));
      });

      await supertest(uw.server)
        .delete(`/api/chat/user/${otherUser.id}`)
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      await retryFor(1500, () => {
        sinon.assert.match(receivedMessages, sinon.match.some(sinon.match({
          command: 'chatDeleteByUser',
          data: sinon.match({
            userID: otherUser.id,
          }),
        })));
      });
    });
  });

  describe('DELETE /chat/:id', () => {
    const messageID = randomUUID();

    it('requires authentication', async () => {
      await supertest(uw.server)
        .delete(`/api/chat/${messageID}`)
        .expect(401);
    });

    it('requires the chat.delete permission', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .delete(`/api/chat/${messageID}`)
        .set('Cookie', `uwsession=${token}`)
        .expect(403);

      await uw.acl.createRole('chatDeleter', ['chat.delete']);
      await uw.acl.allow(user, ['chatDeleter']);

      await supertest(uw.server)
        .delete(`/api/chat/${messageID}`)
        .set('Cookie', `uwsession=${token}`)
        .expect(200);
    });

    it('broadcasts delete messages', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);
      await uw.acl.createRole('chatDeleter', ['chat.delete']);
      await uw.acl.allow(user, ['chatDeleter']);

      const otherUser = await uw.test.createUser();
      const ws = await uw.test.connectToWebSocketAs(otherUser);

      const receivedMessages = [];
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data));
      });

      await supertest(uw.server)
        .delete(`/api/chat/${messageID}`)
        .set('Cookie', `uwsession=${token}`)
        .expect(200);

      await retryFor(1500, () => {
        sinon.assert.match(receivedMessages, sinon.match.some(sinon.match({
          command: 'chatDeleteByID',
          data: sinon.match({
            _id: messageID,
          }),
        })));
      });
    });
  });
});
