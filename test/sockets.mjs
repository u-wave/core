import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import {
  describe, it, beforeEach, afterEach,
} from 'vitest';
import * as sinon from 'sinon';
import supertest from 'supertest';
import createUwave from './utils/createUwave.mjs';
import { retryFor } from './utils/retry.mjs';

const TEST_PASSWORD = 'password';

describe('Sockets', () => {
  let uw;

  beforeEach(async () => {
    uw = await createUwave('sockets');
  });
  afterEach(async () => {
    await uw.close();
  });

  it('keeps messages in queue', async () => {
    const agent = supertest.agent(uw.server);

    // Create a user to log in as
    await agent.post('/api/auth/register')
      .send({ email: 'name@example.com', username: 'name', password: TEST_PASSWORD })
      .expect(200);
    const loginRes = await agent.post('/api/auth/login')
      .send({ email: 'name@example.com', password: TEST_PASSWORD })
      .expect(200);

    const chatter = await uw.test.createUser();

    const user = await uw.users.getUser(loginRes.body.data._id);
    const ws = await uw.test.connectToWebSocketAs(user, loginRes.body.meta.socketToken);
    const wsChatter = await uw.test.connectToWebSocketAs(chatter);

    wsChatter.send(JSON.stringify({ command: 'sendChat', data: 'a' }));
    wsChatter.send(JSON.stringify({ command: 'sendChat', data: 'b' }));

    await retryFor(1500, () => {
      sinon.assert.match(ws.messages, sinon.match.some(sinon.match({
        command: 'chatMessage',
        data: { userID: chatter.id, message: 'a' },
      })));
      sinon.assert.match(ws.messages, sinon.match.some(sinon.match({
        command: 'chatMessage',
        data: { userID: chatter.id, message: 'b' },
      })));
    });

    // Lose the connection
    ws.close();
    await once(ws, 'close');

    // TODO: can we have some stricter guarantee on the server side?
    await setTimeout(100);

    wsChatter.send(JSON.stringify({ command: 'sendChat', data: 'c' }));
    wsChatter.send(JSON.stringify({ command: 'sendChat', data: 'd' }));
    wsChatter.close();
    await once(wsChatter, 'close');

    const now = await agent.get('/api/now').expect(200);

    // Reconnect & receive the messages
    const ws2 = await uw.test.connectToWebSocketAs(user, now.body.socketToken);

    await retryFor(1500, () => {
      sinon.assert.match(ws2.messages, sinon.match.some(sinon.match({
        command: 'chatMessage',
        data: { userID: chatter.id, message: 'c' },
      })));
      sinon.assert.match(ws2.messages, sinon.match.some(sinon.match({
        command: 'chatMessage',
        data: { userID: chatter.id, message: 'd' },
      })));
    });

    ws2.close();
  });
});
