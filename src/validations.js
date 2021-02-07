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

exports.register = {
  body: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        format: 'email',
      },
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 32,
        pattern: /^[^\s\n]+$/.toString(),
      },
      password: {
        type: 'string',
        minLength: 6,
      },
    },
    required: ['email', 'username', 'password'],
  },
};

exports.login = {
  query: {
    type: 'object',
    properties: {
      session: {
        type: 'string',
        enum: ['token', 'cookie'],
        default: 'token',
      },
    },
  },
  body: {
    type: 'object',
    properties: {
      // This is less strict than the email and password validation used in
      // `register`, because we check this against the DB anyway, and an
      // error message about a nonexistent account or mismatching passwords
      // makes more sense when logging in than an error message about the
      // email being incorrectly formatted or the password being too short.
      email: {
        type: 'string',
        minLength: 1,
      },
      password: {
        type: 'string',
        minLength: 1,
      },
    },
    required: ['email', 'password'],
  },
};

exports.requestPasswordReset = {
  body: {
    type: 'object',
    properties: {
      // Checked against DB like in `login`.
      email: {
        type: 'string',
        minLength: 1,
      },
    },
    required: ['email'],
  },
};

exports.passwordReset = {
  params: {
    type: 'object',
    properties: {
      // Technically should be a specific length, but
      // we can let the controller take care of that.
      reset: { type: 'string', minLength: 1 },
    },
    required: ['reset'],
  },
  body: {
    type: 'object',
    properties: {
      password: {
        type: 'string',
        minLength: 6,
      },
    },
    required: ['password'],
  },
};

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

exports.skipBooth = {
  body: {
    type: 'object',
    properties: {
      reason: { type: 'string' },
      userID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
      remove: { type: 'boolean', default: false },
    },
    dependentRequired: {
      reason: ['userID'],
      userID: ['reason'],
    },
  }
};

exports.replaceBooth = {
  body: {
    type: 'object',
    properties: {
      userID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    },
    required: ['userID'],
  },
};

exports.getVote = {
  params: {
    type: 'object',
    properties: {
      historyID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    },
    required: ['historyID'],
  },
};

exports.vote = {
  params: {
    type: 'object',
    properties: {
      historyID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    },
    required: ['historyID'],
  },
  body: {
    type: 'object',
    properties: {
      direction: { enum: [-1, 1] },
    },
    required: ['direction'],
  },
};

exports.favorite = {
  body: {
    type: 'object',
    properties: {
      playlistID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
      historyID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    },
    required: ['playlistID', 'historyID'],
  },
};

exports.getRoomHistory = {
  query: {
    anyOf: [
      {
        oneOf: [
          { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/Pagination' },
          { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/LegacyPagination' },
        ],
      },
      {
        type: 'object',
        properties: {
          filter: {
            type: 'object',
            properties: {
              media: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
            },
          },
        }
      },
    ],
  },
};

// Validations for chat routes:

exports.deleteChatByUser = {
  params: {
    type: 'object',
    properties: {
      id: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    },
    required: ['id'],
  },
};

exports.deleteChatMessage = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', minLength: 1 },
    },
    required: ['id'],
  },
};

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

exports.joinWaitlist = {
  body: {
    type: 'object',
    properties: {
      userID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    },
    required: ['userID'],
  },
};

exports.moveWaitlist = {
  body: {
    type: 'object',
    properties: {
      userID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
      position: {
        type: 'integer',
        minimum: 0,
      },
    },
    required: ['userID', 'position'],
  },
};

exports.lockWaitlist = {
  body: {
    type: 'object',
    properties: {
      lock: { type: 'boolean' },
    },
    required: ['lock'],
  },
};
