'use strict';

const EventEmitter = require('events');
const ms = require('ms');
const Ultron = require('ultron');
const WebSocket = require('ws');
const sjson = require('secure-json-parse');
const debug = require('debug')('uwave:api:sockets:authed');
const RateLimiter = require('../utils/RateLimiter');

class AuthedConnection extends EventEmitter {
  constructor(uw, socket, user) {
    super();
    this.uw = uw;
    this.socket = socket;
    this.events = new Ultron(this.socket);
    this.user = user;
    this.rateLimit = new RateLimiter({
      max: 15,
      duration: ms('5 seconds'),
      id: `api-ws:${this.user.id}`,
      db: uw.redis,
    });

    this.events.on('close', () => {
      this.emit('close', { banned: this.banned });
    });
    this.events.on('message', this.onMessage.bind(this));

    this.lastMessage = Date.now();
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
      const { command, data } = sjson.parse(message);
      this.send(command, data);
    });
    await this.uw.redis.del(this.key, this.messagesKey);
  }

  onMessage(raw) {
    this.rateLimit.getAsync().then((limit) => {
      if (limit.remaining === 0) {
        this.send('rateLimit', {
          retryAfter: limit.reset,
        });
        return;
      }

      const { command, data } = sjson.safeParse(raw) || {};
      if (command) {
        this.emit('command', command, data);
      }
    }, (err) => {
      this.send('error', err.message);
    });
  }

  send(command, data) {
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

module.exports = AuthedConnection;
