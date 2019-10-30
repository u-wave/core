import EventEmitter from 'events';
import Ultron from 'ultron';
import WebSocket from 'ws';
import createDebug from 'debug';
import tryJsonParse from 'try-json-parse';

const debug = createDebug('uwave:api:sockets:authed');

export default class AuthedConnection extends EventEmitter {
  lastMessage = Date.now();

  constructor(uw, socket: WebSocket, user) {
    super();
    this.uw = uw;
    this.socket = socket;
    this.events = new Ultron(this.socket);
    this.user = user;

    this.events.on('close', () => {
      this.emit('close', { banned: this.banned });
    });
    this.events.on('message', this.onMessage.bind(this));

    this.sendWaiting();
  }

  get key() {
    return `http-api:disconnected:${this.user.id}`;
  }

  get messagesKey() {
    return `http-api:disconnected:${this.user.id}:messages`;
  }

  async sendWaiting() {
    const wasDisconnected = await this.uw.redis.exists(this.key);
    if (!wasDisconnected) {
      return;
    }
    const messages = await this.uw.redis.lrange(this.messagesKey, 0, -1);
    if (messages.length) {
      debug('queued', this.user.id, this.user.username, ...messages);
    } else {
      debug('no queued messages', this.user.id, this.user.username);
    }
    messages.forEach((message) => {
      const { command, data } = JSON.parse(message);
      this.send(command, data);
    });
    await this.uw.redis.del(this.key, this.messagesKey);
  }

  onMessage(raw: string) {
    const { command, data } = tryJsonParse(raw) || {};
    if (command) {
      this.emit('command', command, data);
    }
  }

  send(command: string, data: any) {
    this.socket.send(JSON.stringify({ command, data }));
    this.lastMessage = Date.now();
  }

  ping() {
    if (Date.now() - this.lastMessage > 5000 && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send('-');
      this.lastMessage = Date.now();
    }
  }

  ban() {
    debug('ban', this.toString());
    this.banned = true;
    this.send('error', 'You have been banned');
    this.socket.close(4001, 'ban');
  }

  close() {
    debug('close', this.toString());
    this.socket.close();
  }

  removed() {
    this.events.remove();
  }

  toString() {
    return `Authed { user: ${this.user.id} ${this.user.username} }`;
  }
}
