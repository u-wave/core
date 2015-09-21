export default function booth(router) {
  router.post('/booth/skip', (req, res) => {
    if (!req.user || req.user.role < 3) return res.status(412).json('you need to be at least bouncer to do this');
  });

  router.post('/booth/replace', (req, res) => {
    if (!req.user || req.user.role < 3) return res.status(412).json('you need to be at least bouncer to do this');
  });

  router.post('/booth/favorite', (req, res) => {

  });
}
