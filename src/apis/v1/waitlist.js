import redis from 'ioredis';
import debug from 'debug';

const log = debug('uwave:api:v1:waitlist');

const getUser = function(req, res, id, cb) {
  User.findOne({ 'id': req.body.userID })
  .then(user => {
    if (!user) return res.status(404).json('user not found');
    cb(null, cb);
  },
  e => {
    log(e);
    res.status(500).json('internal server error, please try again later');
  });
};

export default function waitlist(router) {
  router.route('/waitlist')

  .get((req, res) => {
    req.uwave.redis.lrange('waitlist', 0, -1)
    .then(waitlist => {
      res.status(200).json(waitlist);
    },
    e => {
      log(e);
      res.status(500).json('couldn\'t fetch playlist');
    });
  })

  .post((req, res) => {
    if (!req.body.userID) return res.status(422).json('no userID set');
    if (!req.user) return res.status(404).json('couldn\'t identify you');

    req.uwave.redis.lrange('waitlist', 0, -1)
    .then(waitlist => {
      const length = waitlist.length;

      for (let i = length - 1; i >= 0; i--) {
        if (waitlist[i] === req.body.userID) {
          return res.status(200).json('already in waitlist');
        }
      }

      if (req.body.userID !== req.user.role && req.user.role < 3) {
        return res.status(412).json('you need to be at least bouncer to do this');
      }

      getUser(req, res, req.body.userID, user => {
        const position = Math.min(parseInt(req.body.position, 10), length);
        const id = waitlist[Math.max(position - 1, 0)];

        if (length > 0) {
          req.uwave.redis.linsert('waitlist', 'AFTER', id, user.id);
        } else {
          req.uwave.redis.lpush('waitlist', user.id);
        }

        waitlist.splice(position, 0, user.id);
        res.status(200).json(waitlist);
      });
    },
    e => {
      log(e);
      res.status(500).json(`couldn't add user ${req.body.userID}`);
    });
  });

  router.put('/waitlist/move', (req, res) => {
    let errors = [];
    if (!req.user || req.user.role < 4) return res.status(412).json('you need to be at least bouncer to do this');
    if (!req.body.userID) errors.push('userID not set');
    if (!req.body.position) errors.push('position not set');

    if (errors.length > 0) return res.status(422).json(errors.join(', '));

    getUser(req, res, req.body.userID, user => {
      req.uwave.redis.get('waitlist')
      .then(waitlist => {
        for (let i = waitlist.length - 1; i >= 0; i--) {
          if (waitlist[i] === user.id) {
            const position = Math.min(parseInt(req.body.position, 10), waitlist.length);
            req.uwave.redis.lrem('waitlist', 1, id);

            if (i > 0) {
              const id = waitlist[i - 1];
              req.uwave.redis.linsert('waitlist', 'AFTER', 1, id, user.id);
            } else {
              const id = waitlist[1];
              req.uwave.redis.linsert('waitlist', 'BEFORE', 1, id, user.id);
            }

            waitlist.splice(i, user.id);
            res.status(200).json(waitlist);
          }
        }
      },
      e => {
        log(e);
        res.status(500).json(`couldn\'t move user ${req.body.userID}`);
      });
    });
  });

  router.put('/waitlist/lock', (req, res) => {
    let errors = [];
    if (!req.user || req.user.role < 4) return res.status(412).json('you need to be at least bouncer to do this');
    if (!req.body.lock) errors.push('lock not set');
    if (!req.body.clear) errors.push('clear not set');

    if (errors.length > 0) return res.status(422).json(errors.join(', '));

    req.uwave.redis.set('waitlist:lock', req.body.lock);
    res.status(200).json({
      'locked': req.body.lock,
      'cleared': req.body.clear
    });
  });

  router.delete('/waitlist/:userID', (req, res) => {
    if (!req.query.userID) return res.status(422).json('userID not set');
    if (req.user.id !== req.query.userID && req.user.role < 3) return res.status(412).json('you need to be at least bouncer to do this');

    req.uwave.redis.lrange('waitlist', 0, -1)
    .then(waitlist => {
      if (waitlist.length === 0) return res.status(412).json('waitlist is empty');

      getUser(req, res, req.query.userID, user => {
        for (let i = waitlist.length - 1; i >= 0; i--) {
          if (waitlist[i] === user.id) {
            req.uwave.redis.lrem('waitlist', 1, user.id);
            waitlist.splice(i, 1);
            return res.status(200).json(waitlist);
          }
        }

        res.status(404).json('user not in waitlist');
      });
    },
    e => {
      log(e);
      res.status(500).json(`couldn't remove user ${req.query.userID}`);
    });
  });
}
