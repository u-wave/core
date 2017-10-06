import { expect } from 'chai';
import sinon from 'sinon';

import chatPlugin from '../src/plugins/chat';

function createUwaveWithChatTest() {
  const uw = {
    redis: {
      exists: sinon.stub().returns(false),
    },
    publish: sinon.spy(),
  };

  chatPlugin()(uw);

  return uw;
}

describe('Chat', () => {
  let uw;

  beforeEach(() => {
    uw = createUwaveWithChatTest();
  });

  it('can broadcast chat messages', async () => {
    await uw.chat.send({ id: 1 }, 'Message text');
    expect(uw.publish).to.have.been.calledWithMatch('chat:message', {
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

    expect(uw.publish).to.have.been.calledWithMatch('chat:message', {
      userID: 1,
    });
    expect(uw.publish).to.not.have.been.calledWithMatch('chat:message', {
      userID: 2,
    });
  });
});
