'use strict';

const {
  Forbidden,
  InternalServerError,
  NotFound,
  TooManyRequests,
  UnprocessableEntity,
} = require('http-errors');
const { t } = require('../locale');

class EmailError extends InternalServerError {
  constructor(message) {
    super(message);
    this.name = 'EmailError';
  }
}

class APIError extends Error {
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

class CombinedError extends APIError {
  constructor(errors) {
    super('Multiple errors');
    this.errors = errors;
  }
}

class PasswordError extends APIError {
  constructor(message) {
    super(message);
    this.name = 'PasswordError';
  }
}

class TokenError extends APIError {
  constructor(message) {
    super(message);
    this.name = 'TokenError';
  }
}

class HTTPError extends APIError {
  constructor(status, message) {
    super(message);
    this.name = 'HTTPError';
    this.status = status;
  }
}

class PermissionError extends Forbidden {
  constructor(message) {
    super(message);
    this.name = 'PermissionError';
  }
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
    constructor(data = {}) {
      const i18nKey = getString(data);
      super(t(i18nKey, data));
      this.name = name;
      this.code = code;
      this.i18nKey = i18nKey;
      this.data = data;
    }

    getMessage(translate = t) {
      return translate(this.i18nKey);
    }
  };
}

const RateLimitError = createErrorClass('RateLimitError', {
  code: 'too-many-requests',
  string: 'errors.tooManyRequests',
  base: TooManyRequests,
});

const NameChangeRateLimitError = createErrorClass('NameChangeRateLimitError', {
  code: 'too-many-requests',
  string: 'errors.tooManyNameChanges',
  base: RateLimitError,
});

const InvalidEmailError = createErrorClass('InvalidEmailError', {
  code: 'invalid-email',
  string: 'errors.invalidEmail',
  base: UnprocessableEntity,
});

const InvalidUsernameError = createErrorClass('InvalidUsernameError', {
  code: 'invalid-username',
  string: 'errors.invalidUsername',
  base: UnprocessableEntity,
});

const UserNotFoundError = createErrorClass('UserNotFoundError', {
  code: 'user-not-found',
  string: 'errors.userNotFound',
  base: NotFound,
});

const PlaylistNotFoundError = createErrorClass('PlaylistNotFoundError', {
  code: 'playlist-not-found',
  string: 'errors.playlistNotFound',
  base: NotFound,
});

const PlaylistItemNotFoundError = createErrorClass('PlaylistItemNotFoundError', {
  code: 'playlist-item-not-found',
  string: 'errors.playlistItemNotFound',
  base: NotFound,
});

const HistoryEntryNotFoundError = createErrorClass('HistoryEntryNotFoundError', {
  code: 'history-entry-not-found',
  string: 'errors.historyEntryNotFound',
  base: NotFound,
});

const CannotSelfFavoriteError = createErrorClass('CannotSelfFavoriteError', {
  code: 'no-self-favorite',
  string: 'errors.noSelfFavorite',
  base: Forbidden,
});

const CannotSelfMuteError = createErrorClass('CannotSelfMuteError', {
  code: 'no-self-mute',
  string: ({ unmute }) => (unmute ? 'errors.noSelfUnmute' : 'errors.noSelfMute'),
  base: Forbidden,
});

const SourceNotFoundError = createErrorClass('SourceNotFoundError', {
  code: 'source-not-found',
  string: 'errors.sourceNotFound',
  base: NotFound,
});

const SourceNoImportError = createErrorClass('SourceNoImportError', {
  code: 'source-no-import',
  string: 'errors.sourceNoImport',
  base: NotFound,
});

const EmptyPlaylistError = createErrorClass('EmptyPlaylistError', {
  code: 'empty-playlist',
  string: 'errors.emptyPlaylist',
  base: Forbidden,
});

exports.EmailError = EmailError;
exports.APIError = APIError;
exports.CombinedError = CombinedError;
exports.PasswordError = PasswordError;
exports.TokenError = TokenError;
exports.HTTPError = HTTPError;
exports.PermissionError = PermissionError;
exports.RateLimitError = RateLimitError;
exports.NameChangeRateLimitError = NameChangeRateLimitError;
exports.InvalidEmailError = InvalidEmailError;
exports.InvalidUsernameError = InvalidUsernameError;
exports.UserNotFoundError = UserNotFoundError;
exports.PlaylistNotFoundError = PlaylistNotFoundError;
exports.PlaylistItemNotFoundError = PlaylistItemNotFoundError;
exports.HistoryEntryNotFoundError = HistoryEntryNotFoundError;
exports.CannotSelfFavoriteError = CannotSelfFavoriteError;
exports.CannotSelfMuteError = CannotSelfMuteError;
exports.SourceNotFoundError = SourceNotFoundError;
exports.SourceNoImportError = SourceNoImportError;
exports.EmptyPlaylistError = EmptyPlaylistError;