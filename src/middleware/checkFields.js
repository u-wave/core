const joi = require('@hapi/joi');
const wrapMiddleware = require('../utils/wrapMiddleware');

function checkFields(types) {
  if (!joi.isSchema(types)) {
    throw new TypeError('checkFields: types must be a joi schema');
  }

  return wrapMiddleware(async (req) => {
    await types.validateAsync(req, {
      abortEarly: false,
      allowUnknown: true,
    });
  });
}

module.exports = checkFields;
