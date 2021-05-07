'use strict';

const assert = require('assert');
const events = require('events');
const sinon = require('sinon');
const delay = require('delay');
const createUwave = require('./utils/createUwave');

const sandbox = sinon.createSandbox();

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

  it('can broadcast chat messages', async () => {
    const user = await uw.test.createUser();

    const ws = await uw.test.connectToWebSocketAs(user);

    ws.send(JSON.stringify({ command: 'sendChat', data: 'Message text' }));

    let found = false;
    await Promise.race([
      (async () => {
        for await (const message of events.on(ws, 'message')) {
          const { command, data } = JSON.parse(message);
          if (command === 'chatMessage' && data.userID === user.id && data.message === 'Message text') {
            found = true;
            break;
          }
        }
      })(),
      delay(500),
    ]);

    assert(found);
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

    let foundUnmuted = false;
    let foundMuted = false;
    await Promise.race([
      (async () => {
        for await (const message of events.on(ws, 'message')) {
          const { command, data } = JSON.parse(message);
          if (command === 'chatMessage') {
            if (data.userID === user.id) {
              foundUnmuted = true;
            }
            if (data.userID === mutedUser.id) {
              foundMuted = true;
            }
          }
        }
      })(),
      delay(1500),
    ]);

    assert(foundUnmuted);
    assert(!foundMuted);
  });
});
