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

    const spy = sandbox.spy(uw, 'publish');

    const ws = await uw.test.connectToWebSocketAs(user);
    ws.send(JSON.stringify({ command: 'sendChat', data: 'Message text' }));
    await delay(200);

    assert(spy.calledWith('chat:message', sinon.match({
      userID: user.id,
      message: 'Message text',
    })));
  });

  it('does not broadcast chat messages from muted users', async () => {
    const user = await uw.test.createUser();
    const mutedUser = await uw.test.createUser();

    const stub = sandbox.stub(uw.chat, 'isMuted');
    stub.withArgs(sinon.match({ id: user.id })).resolves(false);
    stub.withArgs(sinon.match({ id: mutedUser.id })).resolves(true);

    const spy = sandbox.spy(uw, 'publish');

    const ws = await uw.test.connectToWebSocketAs(user);
    ws.send(JSON.stringify({ command: 'sendChat', data: 'unmuted' }));
    const mutedWs = await uw.test.connectToWebSocketAs(mutedUser);
    mutedWs.send(JSON.stringify({ command: 'sendChat', data: 'muted' }));

    await delay(500);

    console.log(spy.getCalls().map((call) => call.args));

    assert(spy.calledWith('chat:message', sinon.match({
      userID: user.id,
    })));

    assert(spy.neverCalledWith('chat:message', sinon.match({
      userID: mutedUser.id,
    })));
  });
});
