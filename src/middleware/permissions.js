export default function _permissions(options) {
  return function permissions(req, res, next) {
    // TODO: add permission handling for the room
    next();
  };
}
