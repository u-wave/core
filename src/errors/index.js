import {
  Forbidden,
  InternalServerError,
  NotFound,
  TooManyRequests,
} from 'http-errors';
import { t } from '../locale';

export class EmailError extends InternalServerError {
  name = 'EmailError';
}

export class APIError extends Error {
  constructor(message) {
    super();
    Error.captureStackTrace(this);
    this.message = message;
  }

  /**
   * Hack to force other Error instances to be public.
   */
  static wrap(error) {
    Object.setPrototypeOf(error, APIError.prototype);
    return error;
  }
}

export class CombinedError extends APIError {
  constructor(errors) {
    super('Multiple errors');
    this.errors = errors;
  }
}

export class PasswordError extends APIError {
  name = 'PasswordError';
}

export class TokenError extends APIError {
  name = 'TokenError';
}

export class HTTPError extends APIError {
  name = 'HTTPError';

  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export class NotFoundError extends HTTPError {
  name = 'NotFoundError';

  constructor(message) {
    super(404, message);
  }
}

export class PermissionError extends Forbidden {
  name = 'PermissionError';
}

function createErrorClass(name, {
  status = 500,
  code = 'unknown-error',
  string,
  base = HTTPError,
}) {
  const getString = typeof string !== 'function'
    ? (() => string)
    : string;

  return class extends base {
    name = name;

    code = code;

    constructor(data) {
      super(status, t(getString(data), data));

      this.string = getString(data);
      this.data = data;
    }

    getMessage(translate = t) {
      return translate(this.string);
    }
  };
}

export const RateLimitError = createErrorClass('RateLimitError', {
  status: 429,
  code: 'too-many-requests',
  string: 'errors.tooManyRequests',
  base: TooManyRequests,
});

export const NameChangeRateLimitError = createErrorClass('NameChangeRateLimitError', {
  status: 429,
  code: 'too-many-requests',
  string: 'errors.tooManyNameChanges',
  base: RateLimitError,
});

export const UserNotFoundError = createErrorClass('UserNotFoundError', {
  status: 404,
  code: 'user-not-found',
  string: 'errors.userNotFound',
  base: NotFound,
});

export const PlaylistNotFoundError = createErrorClass('PlaylistNotFoundError', {
  status: 404,
  code: 'playlist-not-found',
  string: 'errors.playlistNotFound',
  base: NotFound,
});

export const PlaylistItemNotFoundError = createErrorClass('PlaylistItemNotFoundError', {
  status: 404,
  code: 'playlist-item-not-found',
  string: 'errors.playlistItemNotFound',
  base: NotFound,
});

export const HistoryEntryNotFoundError = createErrorClass('HistoryEntryNotFoundError', {
  status: 404,
  code: 'history-entry-not-found',
  string: 'errors.historyEntryNotFound',
  base: NotFound,
});

export const CannotSelfFavoriteError = createErrorClass('CannotSelfFavoriteError', {
  status: 403,
  code: 'no-self-favorite',
  string: 'errors.noSelfFavorite',
  base: Forbidden,
});

export const CannotSelfMuteError = createErrorClass('CannotSelfMuteError', {
  status: 403,
  code: 'no-self-mute',
  string: ({ unmute }) => (unmute ? 'errors.noSelfUnmute' : 'errors.noSelfMute'),
  base: Forbidden,
});

export const SourceNotFoundError = createErrorClass('SourceNotFoundError', {
  status: 404,
  code: 'source-not-found',
  string: 'errors.sourceNotFound',
  base: NotFound,
});

export const SourceNoImportError = createErrorClass('SourceNoImportError', {
  status: 404,
  code: 'source-no-import',
  string: 'errors.sourceNoImport',
  base: NotFound,
});
