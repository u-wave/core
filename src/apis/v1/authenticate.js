import jwt from 'jsonwebtoken';
import bluebird from 'bluebird';
import crypto from 'crypto';
import debug from 'debug';

import User from '../../models/user';
import Authentication from '../../models/authentication';

const log = debug('api:v1:auth');
const pbkdf2 = bluebird.promisify(crypto.pbkdf2);
const randomBytes = bluebird.promisify(crypto.randomBytes);

export default function authenticate(router) {
  router.post('/auth/register', (req, res) => {
    const errors = [];
    let salt = null;

    if (!req.body.email) errors.push('no email set');
    if (!req.body.username) errors.push('no username set');
    if (!req.body.password) errors.push('no password set');
    if (!req.body.passwordRepeat) errors.push('no password confirmation set');

    if (errors.length > 0) return res.status(403).json(errors);

    if (req.body.password !== req.body.passwordRepeat) return res.status(422).json('passwords don\'t match');

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
      return pbkdf2(req.body.password, salt.toString('hex'), 2048, 256, 'sha256');
    })
    // create authentication entry
    .then(hash => {
      log(`hash created successfully, setting up auth entry...`);
      return new Authentication({
        'user': user.id,
        'email': req.body.email,
        'hash': hash.toString('hex'),
        'salt': salt
      })
      .save();
    })
    // send out the data
    .then(() => {
      log(`user ${user.username} created successfully`);
      res.status(200).json(user.toJSON());
    })
    .catch(e => {
      log(`couldn't register user ${user.username}. Err: ${e}`);
      res.status(500).json('internal server error, please try again later');
    });
  });

  router.post('/auth/login', (req, res) => {

  });

  router.post('/auth/password/reset', (req, res) => {

  });

  router.delete('/auth/session/:userID', (req, res) => {

  });
}
