import joi from '@hapi/joi';
import wrapMiddleware from '../utils/wrapMiddleware';

export default function checkFields(types) {
  return wrapMiddleware(async (req) => {
    await types.validateAsync(req, {
      abortEarly: false,
      allowUnknown: true,
    });
  });
}
