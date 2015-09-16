import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import debug from 'debug';

import User from '../../models/user';
import Authentication from '../../models/authentication';

const authLog = debug('api:v1:auth');

export default function authenticate(router) {
  router.post('/auth/register', (req, res) => {
    const errors = [];

    if (!req.body.email) errors.push('no email set');
    if (!req.body.username) errors.push('no username set');
    if (!req.body.password) errors.push('no password set');
    if (!req.body.passwordRepeat) errors.push('no password confirmation set');

    if (errors.length > 0) return res.status(403).json(errors);

    if (req.body.password !== req.body.passwordRepeat) return res.status(422).json('passwords don\'t match');

    authLog(`creating new user ${req.body.email}`);

    const user = new User({ 'username': req.body.username });

    user.save(e => {
      if (e) return res.status(422).json(e);

      authLog(`user ${user.username} created`);
      crypto.randomBytes(256, (e, buf) => {
        if (e) {
          authLog(`couldn't create random byte buffer. Err: ${e}`);
          return res.status(500).json('could not create user, please try again later');
        }
        const salt = buf.toString('hex');

        crypto.pbkdf2(req.body.password, salt, 2048, 256, 'sha256', (e, hash) => {
          if (e) {
            authLog(`couldn't salt password. Err: ${e}`);
            return res.status(500).json('could not set password, please try again later');
          }

          const auth = new Authentication({
            'user': user.id,
            'email': req.body.email,
            'hash': hash.toString('hex'),
            'salt': salt
          });

          auth.save(e => {
            if (e) return res.status(422).json({ 'error': e });

            authLog(`user ${user.username} successfully saved!`);
            return res.status(200).send(user.toJSON());
          });
        });
      });
    });
  });

  router.post('/auth/login', (req, res) => {

  });

  router.post('/auth/password/reset', (req, res) => {

  });

  router.delete('/auth/session/:userID', (req, res) => {

  });
}
