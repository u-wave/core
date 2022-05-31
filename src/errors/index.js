'use strict';

const {
  HttpError,
  BadRequest,
  Forbidden,
  Unauthorized,
  NotFound,
  TooManyRequests,
  UnprocessableEntity,
} = require('http-errors');
const { t } = require('../locale');

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
 * @template {import('i18next').StringMap} TData
 * @template {string} ErrorName
 * @template {string} ErrorCode
 * @param {ErrorName} name
 * @param {{
 *   code: ErrorCode,
 *   string: string | ((data: TData) => string),
 *   base: typeof import('http-errors').HttpError,
 * }} options
 */
function createErrorClass(name, {
  code,
  string,
  base = HttpError,
}) {
  const getString = typeof string !== 'function'
    ? (() => string)
    : string;

  const Error = class extends base {
    /** @param {TData} [data] */
    constructor(data) {
      // @ts-expect-error TS2345 This is actually unsafe but the generic TData type
      // is hard to express correctly in JSDoc.
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

  Error.code = code;

  return Error;
}

const PermissionError = createErrorClass('PermissionError', {
  code: 'forbidden',
  string: 'errors.genericPermission',
  base: Forbidden,
});

const LoginRequiredError = createErrorClass('LoginRequiredError', {
  code: 'forbidden',
  string: 'errors.loginRequired',
  base: Unauthorized,
});

const BannedError = createErrorClass('BannedError', {
  code: 'banned',
  string: 'errors.banned',
  base: Forbidden,
});

const RateLimitError = createErrorClass('RateLimitError', {
  code: 'too-many-requests',
  string: 'errors.tooManyRequests',
  base: TooManyRequests,
});

const NameChangeRateLimitError = createErrorClass('NameChangeRateLimitError', {
  code: 'too-many-requests',
  string: 'errors.tooManyNameChanges',
  base: TooManyRequests,
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

const ReCaptchaError = createErrorClass('ReCaptchaError', {
  code: 'recaptcha-failed',
  string: 'errors.recaptchaFailed',
  base: BadRequest,
});

const IncorrectPasswordError = createErrorClass('IncorrectPasswordError', {
  code: 'incorrect-password',
  string: 'errors.incorrectPassword',
  base: BadRequest,
});

const InvalidResetTokenError = createErrorClass('InvalidResetTokenError', {
  code: 'invalid-reset-token',
  string: 'errors.invalidResetToken',
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

const MediaNotFoundError = createErrorClass('MediaNotFoundError', {
  code: 'media-not-found',
  string: 'errors.mediaNotFound',
  base: NotFound,
});

const ItemNotInPlaylistError = createErrorClass('ItemNotInPlaylistError', {
  code: 'playlist-item-not-found',
  string: 'errors.itemNotInPlaylist',
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

const WaitlistLockedError = createErrorClass('WaitlistLockedError', {
  code: 'waitlist-locked',
  string: 'errors.waitlistLocked',
  base: Forbidden,
});

const AlreadyInWaitlistError = createErrorClass('AlreadyInWaitlistError', {
  code: 'already-in-waitlist',
  string: 'errors.alreadyInWaitlist',
  base: Forbidden,
});

const UserNotInWaitlistError = createErrorClass('UserNotInWaitlistError', {
  code: 'not-in-waitlist',
  string: 'errors.userNotInWaitlist',
  base: NotFound,
});

const UserIsPlayingError = createErrorClass('UserIsPlayingError', {
  code: 'user-is-playing',
  string: 'errors.userIsPlaying',
  base: BadRequest,
});

exports.APIError = APIError;
exports.CombinedError = CombinedError;
exports.HTTPError = HTTPError;
exports.PermissionError = PermissionError;
exports.LoginRequiredError = LoginRequiredError;
exports.BannedError = BannedError;
exports.RateLimitError = RateLimitError;
exports.NameChangeRateLimitError = NameChangeRateLimitError;
exports.InvalidEmailError = InvalidEmailError;
exports.InvalidUsernameError = InvalidUsernameError;
exports.InvalidResetTokenError = InvalidResetTokenError;
exports.ReCaptchaError = ReCaptchaError;
exports.IncorrectPasswordError = IncorrectPasswordError;
exports.UserNotFoundError = UserNotFoundError;
exports.PlaylistNotFoundError = PlaylistNotFoundError;
exports.PlaylistItemNotFoundError = PlaylistItemNotFoundError;
exports.HistoryEntryNotFoundError = HistoryEntryNotFoundError;
exports.MediaNotFoundError = MediaNotFoundError;
exports.ItemNotInPlaylistError = ItemNotInPlaylistError;
exports.CannotSelfFavoriteError = CannotSelfFavoriteError;
exports.CannotSelfMuteError = CannotSelfMuteError;
exports.SourceNotFoundError = SourceNotFoundError;
exports.SourceNoImportError = SourceNoImportError;
exports.EmptyPlaylistError = EmptyPlaylistError;
exports.WaitlistLockedError = WaitlistLockedError;
exports.AlreadyInWaitlistError = AlreadyInWaitlistError;
exports.UserNotInWaitlistError = UserNotInWaitlistError;
exports.UserIsPlayingError = UserIsPlayingError;
