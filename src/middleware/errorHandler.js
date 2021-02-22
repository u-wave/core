'use strict';

const createDebug = require('debug');
const {
  APIError,
  CombinedError,
  RateLimitError,
} = require('../errors');

const debug = createDebug('uwave:http:error');

function toErrorResponse(errors) {
  return {
    data: {},
    meta: {},
    errors,
  };
}

function serializeError(err) {
  if (err instanceof CombinedError) {
    return err.errors.reduce(
      (errors, one) => errors.concat(serializeError(one)),
      [],
    );
  }

  debug(err);

  if (err instanceof APIError) {
    return [{
      status: err.status || 500,
      code: err.code || 'api-error',
      title: err.message,
    }];
  }
  if (err.isJoi) {
    return err.details.map((error) => ({
      status: 400,
      code: error.type,
      title: error.message,
      source: {
        path: error.path,
      },
    }));
  }
  if (err.name === 'ValidationError') {
    return Object.values(err.errors).map((error) => ({
      status: 400,
      code: 'validation-error',
      title: `${error.dataPath} ${error.message}`,
    }));
  }
  if (err.name === 'ReplyError') {
    return [{
      status: 410,
      code: 'redis-error',
      title: 'Database error, please try again later.',
    }];
  }
  if (err.expose) {
    const apiError = {
      status: err.status || 400,
      code: err.code,
      title: err.message,
    };
    if (err.path && err.path[0] === 'body') {
      apiError.source = `#/${err.path.slice(1).join('/')}`;
    }
    return [apiError];
  }
  return [{
    status: 500,
    code: 'unknown-error',
    title: 'Internal Server Error',
  }];
}

function errorHandler(options = {}) {
  return (errors, req, res, next) => {
    if (errors) {
      const error = Array.isArray(errors)
        ? new CombinedError(errors)
        : errors;

      const isRateLimit = error instanceof RateLimitError;
      if (options.onError && !isRateLimit) {
        options.onError(req, error);
      }

      const responseErrors = serializeError(error);

      res
        .status(responseErrors[0].status)
        .json(toErrorResponse(responseErrors));
    } else {
      next();
    }
  };
}

module.exports = errorHandler;
