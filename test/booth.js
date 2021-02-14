'use strict';

const assert = require('assert');
const delay = require('delay');
const supertest = require('supertest');
const createUwave = require('./utils/createUwave');

describe('Booth', () => {
  describe('PUT /booth/:historyID/vote', () => {
    let uw;
    beforeEach(async () => {
      uw = await createUwave('votes');
    });
    afterEach(async () => {
      await uw.destroy();
    });

    const historyID = '602907622d46ab05a89449f3';

    it('requires authentication', async () => {
      await supertest(uw.server)
        .put(`/api/booth/${historyID}/vote`)
        .send({ direction: 1 })
        .expect(403);
    });

    it('validates input', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);

      await supertest(uw.server)
        .put(`/api/booth/${historyID}/vote`)
        .set('Cookie', `uwsession=${token}`)
        .send({ direction: 'not a number' })
        .expect(400);

      await supertest(uw.server)
        .put(`/api/booth/${historyID}/vote`)
        .set('Cookie', `uwsession=${token}`)
        .send({ direction: 0 })
        .expect(400);

      // These inputs are formatted correctly, but we still expect a 412 because
      // the history ID does not exist.
      await supertest(uw.server)
        .put(`/api/booth/${historyID}/vote`)
        .set('Cookie', `uwsession=${token}`)
        .send({ direction: 1 })
        .expect(412);

      await supertest(uw.server)
        .put(`/api/booth/${historyID}/vote`)
        .set('Cookie', `uwsession=${token}`)
        .send({ direction: -1 })
        .expect(412);
    });

    it('broadcasts votes', async () => {
      const dj = await uw.test.createUser();
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);
      const ws = await uw.test.connectToWebSocketAs(user);
      const receivedMessages = [];
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data));
      });

      // Pretend that a DJ exists
      await uw.redis.set('booth:currentDJ', dj.id);
      await uw.redis.set('booth:historyID', historyID);

      await supertest(uw.server)
        .put(`/api/booth/${historyID}/vote`)
        .set('Cookie', `uwsession=${token}`)
        .send({ direction: -1 })
        .expect(200);
      await delay(200);

      assert(receivedMessages.some((message) => message.command === 'vote' && message.data.value === -1));

      receivedMessages.length = 0;
      await supertest(uw.server)
        .put(`/api/booth/${historyID}/vote`)
        .set('Cookie', `uwsession=${token}`)
        .send({ direction: -1 })
        .expect(200);
      await delay(200);

      assert(
        !receivedMessages.some((message) => message.command === 'vote' && message.data.value === -1),
        'should not have re-emitted the vote',
      );

      await supertest(uw.server)
        .put(`/api/booth/${historyID}/vote`)
        .set('Cookie', `uwsession=${token}`)
        .send({ direction: 1 })
        .expect(200);
      await delay(200);

      assert(receivedMessages.some((message) => message.command === 'vote' && message.data.value === 1));
    });
  });
});
