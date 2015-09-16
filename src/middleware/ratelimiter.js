export default function(config) {
  return function rateLimiter(path, router) {
    router.use((req, res, next) => {
      // TODO: add rate limiting
      next();
    });
  };
}
