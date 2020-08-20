'use strict';

const joi = require('@hapi/joi');
const { InvalidUsernameError, InvalidEmailError } = require('./errors');

const objectID = joi.string().length(24);
const userName = joi.string()
  .min(3).max(32)
  .pattern(/^[^\s\n]+$/)
  .error((errors) => {
    const error = new InvalidUsernameError({ username: errors[0].value });
    error.path = errors[0].path;
    error.errors = errors;
    return error;
  });
const userEmail = joi.string().email().error((errors) => {
  const source = errors[0];
  const error = new InvalidEmailError({ email: source.value });
  error.path = source.path;
  error.source = source;
  return error;
});
const userPassword = joi.string().min(6);

const newStylePagination = joi.object({
  page: joi.object({
    offset: joi.number().min(0),
    limit: joi.number().min(0),
  }),
});
const oldStylePagination = joi.object({
  page: joi.number().min(0),
  limit: joi.number().min(0),
});
const pagination = [
  newStylePagination,
  oldStylePagination,
];

// Validations for authentication routes:

exports.register = joi.object({
  body: joi.object({
    email: userEmail.required(),
    username: userName.required(),
    password: userPassword.required(),
  }),
});

exports.login = joi.object({
  query: joi.object({
    session: joi.string().valid('token', 'cookie').default('token'),
  }),
  body: joi.object({
    // This is less strict than the email and password validation used in
    // `register`, because we check this against the DB anyway, and an
    // error message about a nonexistent account or mismatching passwords
    // makes more sense when logging in than an error message about the
    // email being incorrectly formatted or the password being too short.
    email: joi.string().required(),
    password: joi.string().required(),
  }),
});

exports.requestPasswordReset = joi.object({
  body: joi.object({
    // Checked against DB like in `login`.
    email: joi.string().required(),
  }),
});

exports.passwordReset = joi.object({
  params: joi.object({
    reset: joi.string().required(),
  }),
  body: joi.object({
    password: userPassword.required(),
  }),
});

// Validations for ACL routes:

exports.createAclRole = joi.object({
  params: joi.object({
    name: joi.string().required(),
  }),
  body: joi.object({
    permissions: joi.array().items(joi.string()).required(),
  }),
});

exports.deleteAclRole = joi.object({
  params: joi.object({
    name: joi.string().required(),
  }),
});

// Validations for booth routes:

exports.skipBooth = joi.object({
  body: joi.object({
    reason: joi.string().allow(''),
    userID: objectID,
    remove: joi.bool(),
  }).and('userID', 'reason'),
});

exports.replaceBooth = joi.object({
  body: joi.object({
    userID: objectID.required(),
  }),
});

exports.getVote = joi.object({
  params: joi.object({
    historyID: objectID.required(),
  }),
});

exports.vote = joi.object({
  params: joi.object({
    historyID: objectID.required(),
  }),
  body: joi.object({
    direction: joi.number().valid(-1, 1).required(),
  }),
});

exports.favorite = joi.object({
  body: joi.object({
    playlistID: objectID.required(),
    historyID: objectID.required(),
  }),
});

exports.getRoomHistory = joi.object({
  query: joi.alternatives().match('all').try(
    joi.object({
      filter: joi.object({
        media: objectID,
      }),
    }),
    joi.alternatives().try(...pagination),
  ),
});

// Validations for chat routes:

exports.deleteChatByUser = joi.object({
  params: joi.object({
    id: objectID.required(),
  }),
});

exports.deleteChatMessage = joi.object({
  params: joi.object({
    id: joi.string().required(),
  }),
});

// Validations for MOTD routes:

exports.setMotd = joi.object({
  body: joi.object({
    motd: joi.string().required(),
  }),
});

// Validations for playlist routes:

const playlistParams = joi.object({
  id: objectID.required(),
});

const playlistItemParams = joi.object({
  id: objectID.required(),
  itemID: objectID.required(),
});

const playlistItem = joi.object({
  sourceType: joi.string().required(),
  sourceID: joi.string().required(),
  artist: joi.string(),
  title: joi.string(),
  start: joi.number().min(0),
  end: joi.number().min(0),
});
const playlistItemIDs = joi.array().items(objectID);
const playlistItems = joi.array().items(playlistItem);

exports.getPlaylists = joi.object({
  query: joi.object({
    contains: objectID,
  }),
});

exports.createPlaylist = joi.object({
  body: joi.object({
    name: joi.string().required(),
  }),
});

exports.getPlaylist = joi.object({
  params: playlistParams,
});

exports.deletePlaylist = joi.object({
  params: playlistParams,
});

exports.updatePlaylist = joi.object({
  params: playlistParams,
  body: joi.object({
    name: joi.string(),
    shared: joi.bool(),
    description: joi.string(),
  }),
});

exports.renamePlaylist = joi.object({
  params: playlistParams,
  body: joi.object({
    name: joi.string().required(),
  }),
});

exports.sharePlaylist = joi.object({
  params: playlistParams,
  body: joi.object({
    shared: joi.bool().required(),
  }),
});

exports.getPlaylistItems = joi.object({
  params: playlistParams,
  query: pagination,
});

exports.addPlaylistItems = joi.object({
  params: playlistParams,
  body: joi.object({
    items: playlistItems.required(),
  }),
});

exports.removePlaylistItems = joi.object({
  params: playlistParams,
  body: joi.object({
    items: playlistItemIDs.required(),
  }),
});

exports.movePlaylistItems = joi.object({
  params: playlistParams,
  body: joi.object({
    items: playlistItemIDs.required(),
    after: [
      objectID, // Insert after ID
      joi.number().valid(-1), // Old-style prepend (use at=start instead)
    ],
    at: joi.string().valid('start', 'end'),
  }).xor('after', 'at'),
});

exports.shufflePlaylistItems = joi.object({
  params: playlistParams,
});

exports.getPlaylistItem = joi.object({
  params: playlistItemParams,
});

exports.updatePlaylistItem = joi.object({
  params: playlistItemParams,
  body: joi.object({
    artist: joi.string(),
    title: joi.string(),
    start: joi.number().min(0),
    end: joi.number().min(0),
  }),
});

exports.removePlaylistItem = joi.object({
  params: playlistItemParams,
});

// Validations for user routes:

const userParams = joi.object({
  id: objectID.required(),
});

exports.getUser = joi.object({
  params: userParams,
});

exports.muteUser = joi.object({
  params: userParams,
  body: joi.object({
    time: joi.number().min(0).required(),
  }),
});

exports.unmuteUser = joi.object({
  params: userParams,
});

exports.addUserRole = joi.object({
  params: joi.object({
    id: objectID.required(),
    role: joi.string().required(),
  }),
});

exports.removeUserRole = joi.object({
  params: joi.object({
    id: objectID.required(),
    role: joi.string().required(),
  }),
});

exports.setUserName = joi.object({
  params: userParams,
  body: joi.object({
    username: userName,
  }),
});

exports.setUserAvatar = joi.object({
  params: userParams,
  body: joi.object({
    avatar: joi.string(),
  }),
});

exports.setUserStatus = joi.object({
  params: userParams,
  body: joi.object({
    status: joi.number(),
  }),
});

exports.getUserHistory = joi.object({
  params: userParams,
  query: pagination,
});

// Validations for Waitlist routes:

exports.joinWaitlist = joi.object({
  body: joi.object({
    userID: objectID.required(),
  }),
});

exports.moveWaitlist = joi.object({
  body: joi.object({
    userID: objectID.required(),
    position: joi.number().min(0).required(),
  }),
});

exports.lockWaitlist = joi.object({
  body: joi.object({
    lock: joi.bool().required(),
  }),
});
