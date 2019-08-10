import toItemResponse from '../utils/toItemResponse';

// eslint-disable-next-line import/prefer-default-export
export function getServerTime(req) {
  return toItemResponse({
    time: Date.now(),
  }, { url: req.fullUrl });
}
