# For social auth
login-success-title = Success
login-close-this-window = You can now close this window.

# Used in src/errors/index.js
error-too-many-requests = Rate limit exceeded, retry in { $retry-after }.
error-login-required = You must be logged in to do this.
error-banned = You have been banned.
error-generic-permission = You do not have permission to do that.
error-invalid-email = The email address is not formatted correctly.
error-email-in-use = The email address is already in use.
error-invalid-username = Invalid username. Names must be 3 to 32 characters long and must not contain spaces.
error-username-in-use = The username is already in use.
error-recaptcha-failed = ReCaptcha validation failed, please try again.
error-invalid-reset-token = That reset token is invalid. Please double-check your reset token or request a new password reset.
error-incorrect-password = The password is incorrect.
error-user-not-found = User not found.
error-role-not-found = Role not found.
error-playlist-not-found = Playlist not found.
error-playlist-item-not-found = Playlist item not found.
error-item-not-in-playlist = Item not in playlist.
error-empty-playlist = You don't have anything to play. Please add some songs to your playlist and try again.
error-history-entry-not-found = History entry not found.
error-media-not-found = Media object not found.
error-no-self-favorite = You can't favorite your own plays.
error-no-self-mute =
  { $action ->
    [unmute] You can't unmute yourself.
    *[mute] You can't mute yourself.
  }
error-source-not-found = Source "{ $name }" not found.
error-source-no-import = Source "{ $name }" does not support importing.
error-too-many-name-changes = You can only change your username five times per hour. Try again in { $retry-after }.
error-waitlist-locked = The waitlist is locked. Only staff can join.
error-already-in-waitlist = You are already in the waitlist.
error-user-not-in-waitlist = That user is not in the waitlist.
error-user-is-playing = That user is currently playing.
