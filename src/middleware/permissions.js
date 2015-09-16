export default function permissions(router, options) {
  router.use((req, res, next) => {
    // TODO: add permission handling for the room
    next();
  });
}
