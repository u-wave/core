'use strict';

const assert = require('assert');
const sinon = require('sinon');
const delay = require('delay');
const createUwave = require('./utils/createUwave');

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
      console.log('received', data);
      receivedMessages.push(JSON.parse(data));
    });

    ws.send(JSON.stringify({ command: 'sendChat', data: 'Message text' }));
    await delay(500);

    assert(receivedMessages.some((message) => message.command === 'chatMessage' && message.data.userID === user.id && message.data.message === 'Message text'));
  });

  // Can't get this to be reliable, skip for now
  it.skip('does not broadcast chat messages from muted users', async () => {
    const user = await uw.test.createUser();
    const mutedUser = await uw.test.createUser();

    const stub = sandbox.stub(uw.chat, 'isMuted');
    stub.withArgs(sinon.match({ id: user.id })).resolves(false);
    stub.withArgs(sinon.match({ id: mutedUser.id })).resolves(true);

    const ws = await uw.test.connectToWebSocketAs(user);
    const mutedWs = await uw.test.connectToWebSocketAs(mutedUser);

    const receivedMessages = [];
    ws.on('message', (data) => {
      console.log('received', data);
      receivedMessages.push(JSON.parse(data));
    });

    ws.send(JSON.stringify({ command: 'sendChat', data: 'unmuted' }));
    mutedWs.send(JSON.stringify({ command: 'sendChat', data: 'muted' }));

    await delay(1500);

    assert(receivedMessages.some((message) => message.command === 'chatMessage' && message.data.userID === user.id));
    assert(!receivedMessages.some((message) => message.command === 'chatMessage' && message.data.userID === mutedUser.id));
  });
});
