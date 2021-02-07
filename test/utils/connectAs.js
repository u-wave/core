'use strict';

const WebSocket = require('ws');
const events = require('events');

async function connectAs(uw, user) {
  const { port } = uw.server.address();
  const ws = new WebSocket(`ws://localhost:${port}`);
  const token = uw.socketServer.authRegistry.createAuthToken(user);
  await events.once(ws, 'open');

  ws.send(await token);

  await new Promise((resolve, reject) => {
    function listener(buffer) {
      let data;
      try {
        data = JSON.parse(buffer);
      } catch (err) {
        reject(err);
        return;
      }

      if (data.command === 'error') {
        reject(new Error(data.data));
      } else if (data.command === 'authenticated') {
        resolve();
      } else {
        reject(new Error(`unexpected socket message ${buffer}`));
      }
    }
    ws.on('message', listener);
  });

  return ws;
}

module.exports = connectAs;
