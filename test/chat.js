const sinon = require('sinon');
const chatPlugin = require('../src/plugins/chat');

async function createUwaveWithChatTest() {
  const uw = {
    redis: {
      exists: sinon.stub().returns(false),
    },
    httpApi: {
      use: sinon.stub(),
    },
    publish: sinon.spy(),
  };

  await chatPlugin(uw);

  return uw;
}

describe('Chat', () => {
  let uw;

  beforeEach(async () => {
    uw = await createUwaveWithChatTest();
  });

  it('can broadcast chat messages', async () => {
    await uw.chat.send({ id: 1 }, 'Message text');
    sinon.assert.calledWithMatch(uw.publish, 'chat:message', {
      userID: 1,
      message: 'Message text',
    });
  });

  it('does not broadcast chat messages from muted users', async () => {
    const stub = sinon.stub(uw.chat, 'isMuted');
    stub.withArgs({ id: 1 }).returns(false);
    stub.withArgs({ id: 2 }).returns(true);

    await uw.chat.send({ id: 1 }, 'Message text');
    await uw.chat.send({ id: 2 }, 'Message text');

    sinon.assert.calledWithMatch(uw.publish, 'chat:message', {
      userID: 1,
    });
    sinon.assert.neverCalledWithMatch(uw.publish, 'chat:message', {
      userID: 2,
    });
  });
});
