import assert from 'assert';
import sinon from 'sinon';
import delay from 'delay';
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

  it('can broadcast chat messages', async () => {
    const user = await uw.test.createUser();

    const ws = await uw.test.connectToWebSocketAs(user);

    const receivedMessages = [];
    ws.on('message', (data) => {
      receivedMessages.push(JSON.parse(data));
    });

    ws.send(JSON.stringify({ command: 'sendChat', data: 'Message text' }));
    await waitFor(() => (
      receivedMessages.some((message) => (
        message.command === 'chatMessage'
        && message.data.userID === user.id
        && message.data.message === 'Message text'
      ))
    ), 5_000);
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
});
