import joi from '@hapi/joi';
import wrapMiddleware from '../utils/wrapMiddleware';

export default function checkFields(types) {
  return wrapMiddleware(async (req) => {
    await joi.validate(req, types, {
      abortEarly: false,
      allowUnknown: true,
    });
  });
}
