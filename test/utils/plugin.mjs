import events from 'events';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

async function testPlugin(uw) {
  const { User } = uw.models;

  let i = Date.now();
  async function createUser() {
    const props = {
      _id: new mongoose.Types.ObjectId(),
      username: `test_user_${i.toString(36)}`,
      slug: i.toString(36),
    };
    i += 1;
    const user = new User(props);
    await user.save();
    return user;
  }

  async function connectToWebSocketAs(user) {
    const { port } = uw.server.address();
    const token = await uw.socketServer.authRegistry.createAuthToken(user);

    const ws = new WebSocket(`ws://localhost:${port}`);
    await events.once(ws, 'open');

    ws.send(token);

    const [buffer, isBinary] = await events.once(ws, 'message');
    const data = JSON.parse(isBinary ? buffer.toString() : buffer);

    if (data.command === 'error') {
      throw new Error(data.data);
    } else if (data.command !== 'authenticated') {
      throw new Error(`unexpected socket message ${buffer}`);
    }

    return ws;
  }

  async function createTestSessionToken(user) {
    const token = jwt.sign(
      { id: user.id },
      uw.options.secret,
      { expiresIn: '1d' },
    );
    return token;
  }

  uw.test = {
    createUser,
    createTestSessionToken,
    connectToWebSocketAs,
  };
}

export default testPlugin;
