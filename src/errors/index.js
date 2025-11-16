import httpErrors from 'http-errors';
import { t } from '../locale.js';

const {
  HttpError,
  BadRequest,
  Forbidden,
  Unauthorized,
  NotFound,
  TooManyRequests,
  UnprocessableEntity,
} = httpErrors;

class APIError extends Error {
  /** @type {number|undefined} */
  status;

  /** @type {string|undefined} */
  code;

  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    Error.captureStackTrace(this);
    this.message = message;
  }

  /**
   * Hack to force other Error instances to be public.
   *
   * @param {Error} error
   */
  static wrap(error) {
    Object.setPrototypeOf(error, APIError.prototype);
    return error;
  }
}

class CombinedError extends APIError {
  /**
   * @param {Error[]} errors
   */
  constructor(errors) {
    super('Multiple errors');
    this.errors = errors;
  }
}

class HTTPError extends APIError {
  /**
   * @param {number} status
   * @param {string} message
   */
  constructor(status, message) {
    super(message);
    this.name = 'HTTPError';
    this.status = status;
  }
}

/**
 * @template {Record<string, import('@fluent/bundle').FluentValue>} TData
 * @template {string} ErrorName
 * @template {string} ErrorCode
 * @param {ErrorName} name
 * @param {{
 *   code: ErrorCode,
 *   string: string,
 *   base: typeof import('http-errors').HttpError,
 * }} options
 */
function createErrorClass(name, {
  code,
  string: i18nKey,
  base = HttpError,
}) {
  const Error = class extends base {
    static code = code;

    code = code;

    name = name;

    /** @param {TData} [data] */
    constructor(data) {
      super(t(i18nKey, data ?? {}) ?? undefined);
      this.i18nKey = i18nKey;
      this.data = data;
      // http-errors overwrites the prototype of the error, so it will
      // point to the superclass.
      // Patch it back to make `instanceof DerivedError` work correctly.
      Object.setPrototypeOf(this, Error.prototype);
    }

    getMessage(translate = t) {
      return translate(this.i18nKey);
    }
  };

  return Error;
}

const PermissionError = createErrorClass('PermissionError', {
  code: 'forbidden',
  string: 'error-generic-permission',
  base: Forbidden,
});

const LoginRequiredError = createErrorClass('LoginRequiredError', {
  code: 'forbidden',
  string: 'error-login-required',
  base: Unauthorized,
});

const BannedError = createErrorClass('BannedError', {
  code: 'banned',
  string: 'error-banned',
  base: Forbidden,
});

const RateLimitError = createErrorClass('RateLimitError', {
  code: 'too-many-requests',
  string: 'error-too-many-requests',
  base: TooManyRequests,
});

const NameChangeRateLimitError = createErrorClass('NameChangeRateLimitError', {
  code: 'too-many-requests',
  string: 'error-too-many-name-changes',
  base: TooManyRequests,
});

const InvalidEmailError = createErrorClass('InvalidEmailError', {
  code: 'invalid-email',
  string: 'error-invalid-email',
  base: UnprocessableEntity,
});

const UsedEmailError = createErrorClass('UsedEmailError', {
  code: 'invalid-email',
  string: 'error-email-in-use',
  base: UnprocessableEntity,
});

const InvalidUsernameError = createErrorClass('InvalidUsernameError', {
  code: 'invalid-username',
  string: 'error-invalid-username',
  base: UnprocessableEntity,
});

const UsedUsernameError = createErrorClass('UsedUsernameError', {
  code: 'invalid-username',
  string: 'error-username-in-use',
  base: UnprocessableEntity,
});

const ReCaptchaError = createErrorClass('ReCaptchaError', {
  code: 'recaptcha-failed',
  string: 'error-recaptcha-failed',
  base: BadRequest,
});

const IncorrectPasswordError = createErrorClass('IncorrectPasswordError', {
  code: 'incorrect-password',
  string: 'error-incorrect-password',
  base: BadRequest,
});

const InvalidResetTokenError = createErrorClass('InvalidResetTokenError', {
  code: 'invalid-reset-token',
  string: 'error-invalid-reset-token',
  base: UnprocessableEntity,
});

const UserNotFoundError = createErrorClass('UserNotFoundError', {
  code: 'user-not-found',
  string: 'error-user-not-found',
  base: NotFound,
});

const RoleNotFoundError = createErrorClass('RoleNotFoundError', {
  code: 'role-not-found',
  string: 'error-role-not-found',
  base: NotFound,
});

const PlaylistNotFoundError = createErrorClass('PlaylistNotFoundError', {
  code: 'playlist-not-found',
  string: 'error-playlist-not-found',
  base: NotFound,
});

const PlaylistItemNotFoundError = createErrorClass('PlaylistItemNotFoundError', {
  code: 'playlist-item-not-found',
  string: 'error-playlist-item-not-found',
  base: NotFound,
});

const HistoryEntryNotFoundError = createErrorClass('HistoryEntryNotFoundError', {
  code: 'history-entry-not-found',
  string: 'error-history-entry-not-found',
  base: NotFound,
});

const MediaNotFoundError = createErrorClass('MediaNotFoundError', {
  code: 'media-not-found',
  string: 'error-media-not-found',
  base: NotFound,
});

const ItemNotInPlaylistError = createErrorClass('ItemNotInPlaylistError', {
  code: 'playlist-item-not-found',
  string: 'error-item-not-in-playlist',
  base: NotFound,
});

const CannotSelfFavoriteError = createErrorClass('CannotSelfFavoriteError', {
  code: 'no-self-favorite',
  string: 'error-no-self-favorite',
  base: Forbidden,
});

const CannotSelfMuteError = createErrorClass('CannotSelfMuteError', {
  code: 'no-self-mute',
  string: 'error-no-self-mute',
  base: Forbidden,
});

const SourceNotFoundError = createErrorClass('SourceNotFoundError', {
  code: 'source-not-found',
  string: 'error-source-not-found',
  base: NotFound,
});

const SourceNoImportError = createErrorClass('SourceNoImportError', {
  code: 'source-no-import',
  string: 'error-source-no-import',
  base: NotFound,
});

const EmptyPlaylistError = createErrorClass('EmptyPlaylistError', {
  code: 'empty-playlist',
  string: 'error-empty-playlist',
  base: Forbidden,
});

const WaitlistLockedError = createErrorClass('WaitlistLockedError', {
  code: 'waitlist-locked',
  string: 'error-waitlist-locked',
  base: Forbidden,
});

const AlreadyInWaitlistError = createErrorClass('AlreadyInWaitlistError', {
  code: 'already-in-waitlist',
  string: 'error-already-in-waitlist',
  base: BadRequest,
});

const UserNotInWaitlistError = createErrorClass('UserNotInWaitlistError', {
  code: 'not-in-waitlist',
  string: 'error-user-not-in-waitlist',
  base: NotFound,
});

const UserIsPlayingError = createErrorClass('UserIsPlayingError', {
  code: 'user-is-playing',
  string: 'error-user-is-playing',
  base: BadRequest,
});

export {
  APIError,
  CombinedError,
  HTTPError,
  PermissionError,
  LoginRequiredError,
  BannedError,
  RateLimitError,
  NameChangeRateLimitError,
  InvalidEmailError,
  UsedEmailError,
  InvalidUsernameError,
  UsedUsernameError,
  InvalidResetTokenError,
  ReCaptchaError,
  IncorrectPasswordError,
  UserNotFoundError,
  RoleNotFoundError,
  PlaylistNotFoundError,
  PlaylistItemNotFoundError,
  HistoryEntryNotFoundError,
  MediaNotFoundError,
  ItemNotInPlaylistError,
  CannotSelfFavoriteError,
  CannotSelfMuteError,
  SourceNotFoundError,
  SourceNoImportError,
  EmptyPlaylistError,
  WaitlistLockedError,
  AlreadyInWaitlistError,
  UserNotInWaitlistError,
  UserIsPlayingError,
};
