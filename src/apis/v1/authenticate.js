import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import bluebird from 'bluebird';
import crypto from 'crypto';
import redis from 'ioredis';
import debug from 'debug';

const log = debug('uwave:api:v1:auth');
const verify = bluebird.promisify(jwt.verify);
const pbkdf2 = bluebird.promisify(crypto.pbkdf2);
const randomBytes = bluebird.promisify(crypto.randomBytes);

class PasswordError extends Error {
  constructor(str) {
    super();
    Error.captureStackTrace(this);
    this.name = 'PasswordError';
    this.message = str;
  }
}

class TokenError extends Error {
  constructor(str) {
    super();
    Error.captureStackTrace(this);
    this.name = 'TokenError';
    this.message = str;
  }
}

export default function authenticate(router) {
  const User = mongoose.model('User');
  const Authentication = mongoose.model('Authentication');

  router.post('/auth/register', (req, res) => {
    const errors = [];
    let salt = null;

    if (!req.body.email) errors.push('no email set');
    if (!req.body.username) errors.push('no username set');
    if (!req.body.password) errors.push('no password set');
    if (!req.body.passwordRepeat) errors.push('no password confirmation set');

    if (errors.length > 0) return res.status(422).json(errors.join(', '));

    if (req.query.token) {
      return res.status(418).json(
        `you are already registered and logged in. I presume you dropped this on your way in '${req.query.token}' :P`
      );
    }

    log(`creating new user ${req.body.email}`);

    const user = new User({ 'username': req.body.username });

    user.save()
    // generate salt
    .then(() => {
      log(`user ${user.username} successfully validated`);
      return randomBytes(256);
    })
    // encrypt password
    .then(buf => {
      salt = buf.toString('hex');
      return pbkdf2(req.body.password, salt, 2048, 256, 'sha256');
    })
    // create authentication entry
    .then(hash => {
      log(`hash created successfully, setting up auth entry...`);
      return new Authentication({
        'user': user.id,
        'email': req.body.email,
        'hash': hash.toString('hex'),
        'salt': salt
      }).save();
    })
    // send out the data
    .then(() => {
      log(`user ${user.username} created successfully`);
      res.status(200).json(user.toJSON());
    })
    .catch(redis.ReplyError, e => {
      log(`couldn't fetch data from redis. Err: ${e}`);
      res.status(410).json('could not save user');

      // the user was already saved, so if anything should go wrong while creating a proper hash etc.
      // we should clean up the mess we've made.
      user.remove(e => {
        if (e) return log(`couldn't delete user ${user.username}. Err: ${e}`);
        log(`removed user ${user.username} successfully`);
      });
    })
    .catch(e => {
      log(`couldn't register user ${user.username}. Err: ${e}`);
      res.status(500).json('internal server error, please try again later');

      user.remove(e => {
        if (e) return log(`couldn't delete user ${user.username}. Err: ${e}`);
        log(`removed user ${user.username} successfully`);
      });
    });
  });

  router.post('/auth/login', (req, res) => {
    const errors = [];
    let auth = null;

    if (!req.body.email) errors.push('email not set');
    if (!req.body.password) errors.push('password not set');

    if (errors.length > 0) return res.status(403).json(errors.join(', '));

    Authentication.findOne({ 'email': req.body.email }).populate('user').exec()
    .then(auth => {
      auth = auth;
      return pbkdf2(req.body.password, auth.salt, 2048, 256, 'sha256');
    })
    .then(hash => {
      if (auth.hash === hash.toString('hex')) {
        const token = jwt.sign(auth.user.id, 'test');
        req.uwave.redis.hmset(`user:${token}`,
          'id', auth.user.id,
          'username', auth.user.username,
          'role', auth.user.role
        );
        req.uwave.redis.expire(`user:${token}`, 30*24*60*60);
        res.status(200).json(token);
      } else {
        throw new PasswordError('password is incorrect');
      }
    })
    .catch(PasswordError, e => {
      res.status(401).json(e.message);
    })
    .catch(e => {
      log(`error occured while user ${auth ? auth.user.username : null} was trying to log in. Err: ${e}`);
      res.status(500).json('couldn\'t log you in');
    });
  });

  router.route('/auth/password/reset')

  .post((req, res) => {
    if (!req.body.email) return res.status(422).json('email not set');

    Authentication.findOne({ 'email': req.body.email })
    .then(() => {
      return randomBytes(64);
    })
    .then(buf => {
      const random = buf.toString('hex');
      // save reset code for a day
      req.uwave.redis.set(`reset:${user.req.body.email}`, random, `NX EXPIRE ${24*60*60}`);
      res.status(200).json(random);
    })
    .catch(redis.ReplyError, e => {
      log(`couldn't set reset link. Err: ${e}`);
      res.status(410).json('could not generate reset code');
    })
    .catch(e => {
      log(`error occured while generating reset code. Err: ${e}`);
      res.status(500).json('internal server error, please try again later');
    });
  })

  .put((req, res) => {
    const errors = [];
    let salt = null;

    if (!req.body.email) errors.push('email not set');
    if (!req.body.reset) errors.push('reset code not set');
    if (!req.body.password) errors.push('password not set');

    if (errors.length > 0) return res.status(422).json(errors.join(', '));
    if (req.body.password !== req.body.passwordRepeat) return res.status(422).json('passwords don\'t match');

    req.uwave.redis.get(`reset:${req.body.reset}`)
    .then(token => {
      if (!token) throw new TokenError('token invalid');
      return randomBytes(256);
    })
    .then(buf => {
      salt = buf.toString('hex');
      return pbkdf2(req.body.password, salt, 2048, 256, 'sha256');
    })
    .then(hash => {
      return Authentication.findOneAndUpdate(
        { 'email': req.body.email },
        {
          'salt': salt,
          'hash': hash.toString('hex')
        },
        { 'upsert': true }
      ).exec();
    })
    .then(auth => {
      if (!auth) {
        res.status(404).json(`no user with email '${req.body.email}' found`);
      } else {
        res.status(200).json('password updated!');
        req.uwave.redis.del(`reset:${req.body.reset}`);
      }
    })
    .catch(TokenInvalid, e => {
      log(`${req.ip} tried to reset password for ${req.body.email} but failed`);
      res.status(422).json('invalid reset code');
    })
    .catch(redis.ReplyError, e => {
      res.status(410).json('invalid reset code');
    })
    .catch(e => {
      log(`resetting the password for user with email ${req.body.email} failed. Err: ${e}`);
      res.status(500).json('internal server error, please try again later');
    });
  });

  router.delete('/auth/session/:userID', (req, res) => {
    if (!req.params.userID) return res.status(422).json('no userID set');

    Authentication.findOne({ 'user': req.params.userID })
    .then(auth => {
      req.uwave.redis.del(`token:${req.query.token}`);
      res.status(200).send();
    })
    .catch(redis.ReplyError, e => {
      log(`couldn't delete user hash. Err: ${e}`);
      res.status(410).json('could not delete session');
    })
    .catch(e => {
      log(`error occured while deleting the user hash. Err: ${e}`);
      res.status(500).json('internal server error, please try again later');
    });
  });
}
