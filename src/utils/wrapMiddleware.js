/**
 * Wrap `async` middleware into an express style callback.
 */
export default function wrapMiddleware(middleware) {
  return (req, res, next) => {
    middleware(req, res)
      .then(() => next(), next);
  };
}
