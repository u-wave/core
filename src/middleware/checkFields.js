import joi from '@hapi/joi';
import wrapMiddleware from '../utils/wrapMiddleware';

export default function checkFields(types) {
  if (!joi.isSchema(types)) {
    throw new TypeError('checkFields: types must be a joi schema')
  }

  return wrapMiddleware(async (req) => {
    await types.validateAsync(req, {
      abortEarly: false,
      allowUnknown: true,
    });
  });
}
