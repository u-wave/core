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

export class PermissionError extends Forbidden {
  name = 'PermissionError';
}

function createErrorClass(name, {
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
      const i18nKey = getString(data);
      super(t(i18nKey, data));

      this.i18nKey = i18nKey;
      this.data = data;
    }

    getMessage(translate = t) {
      return translate(this.i18nKey);
    }
  };
}

export const RateLimitError = createErrorClass('RateLimitError', {
  code: 'too-many-requests',
  string: 'errors.tooManyRequests',
  base: TooManyRequests,
});

export const NameChangeRateLimitError = createErrorClass('NameChangeRateLimitError', {
  code: 'too-many-requests',
  string: 'errors.tooManyNameChanges',
  base: RateLimitError,
});

export const UserNotFoundError = createErrorClass('UserNotFoundError', {
  code: 'user-not-found',
  string: 'errors.userNotFound',
  base: NotFound,
});

export const PlaylistNotFoundError = createErrorClass('PlaylistNotFoundError', {
  code: 'playlist-not-found',
  string: 'errors.playlistNotFound',
  base: NotFound,
});

export const PlaylistItemNotFoundError = createErrorClass('PlaylistItemNotFoundError', {
  code: 'playlist-item-not-found',
  string: 'errors.playlistItemNotFound',
  base: NotFound,
});

export const HistoryEntryNotFoundError = createErrorClass('HistoryEntryNotFoundError', {
  code: 'history-entry-not-found',
  string: 'errors.historyEntryNotFound',
  base: NotFound,
});

export const CannotSelfFavoriteError = createErrorClass('CannotSelfFavoriteError', {
  code: 'no-self-favorite',
  string: 'errors.noSelfFavorite',
  base: Forbidden,
});

export const CannotSelfMuteError = createErrorClass('CannotSelfMuteError', {
  code: 'no-self-mute',
  string: ({ unmute }) => (unmute ? 'errors.noSelfUnmute' : 'errors.noSelfMute'),
  base: Forbidden,
});

export const SourceNotFoundError = createErrorClass('SourceNotFoundError', {
  code: 'source-not-found',
  string: 'errors.sourceNotFound',
  base: NotFound,
});

export const SourceNoImportError = createErrorClass('SourceNoImportError', {
  code: 'source-no-import',
  string: 'errors.sourceNoImport',
  base: NotFound,
});
