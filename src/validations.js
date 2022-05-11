'use strict';

// Validations for authentication routes:

exports.register = /** @type {const} */ ({
  body: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        format: 'email',
      },
      username: {
        $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/Username',
      },
      password: {
        type: 'string',
        minLength: 6,
      },
      grecaptcha: { type: 'string', nullable: true },
    },
    required: ['email', 'username', 'password'],
  },
});

exports.login = /** @type {const} */ ({
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
});

exports.requestPasswordReset = /** @type {const} */ ({
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
});

exports.passwordReset = /** @type {const} */ ({
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
});

// Validations for ACL routes:

exports.createAclRole = /** @type {const} */ ({
  params: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
    },
    required: ['name'],
  },
  body: {
    type: 'object',
    properties: {
      permissions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['permissions'],
  },
});

exports.deleteAclRole = /** @type {const} */ ({
  params: {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    required: ['name'],
  },
});

// Validations for booth routes:

exports.skipBooth = /** @type {const} */ ({
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
  },
});

exports.replaceBooth = /** @type {const} */ ({
  body: {
    type: 'object',
    properties: {
      userID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    },
    required: ['userID'],
  },
});

exports.getVote = /** @type {const} */ ({
  params: {
    type: 'object',
    properties: {
      historyID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    },
    required: ['historyID'],
  },
});

exports.vote = /** @type {const} */ ({
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
});

exports.favorite = /** @type {const} */ ({
  body: {
    type: 'object',
    properties: {
      playlistID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
      historyID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    },
    required: ['playlistID', 'historyID'],
  },
});

exports.getRoomHistory = /** @type {const} */ ({
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
        },
      },
    ],
  },
});

// Validations for chat routes:

exports.deleteChatByUser = /** @type {const} */ ({
  params: {
    type: 'object',
    properties: {
      id: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    },
    required: ['id'],
  },
});

exports.deleteChatMessage = /** @type {const} */ ({
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', minLength: 1 },
    },
    required: ['id'],
  },
});

// Validations for MOTD routes:

exports.setMotd = /** @type {const} */ ({
  body: {
    type: 'object',
    properties: {
      // `null` to remove the MOTD.
      motd: { type: ['string', 'null'] },
    },
    required: ['motd'],
  },
});

// Validations for playlist routes:

const playlistParams = /** @type {const} */ ({
  type: 'object',
  properties: {
    id: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
  },
  required: ['id'],
});

const playlistItemParams = /** @type {const} */ ({
  type: 'object',
  properties: {
    id: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    itemID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
  },
  required: ['id', 'itemID'],
});

exports.getPlaylists = /** @type {const} */ ({
  query: {
    type: 'object',
    properties: {
      contains: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    },
  },
});

exports.createPlaylist = /** @type {const} */ ({
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
    },
    required: ['name'],
  },
});

exports.getPlaylist = /** @type {const} */ ({
  params: playlistParams,
});

exports.deletePlaylist = /** @type {const} */ ({
  params: playlistParams,
});

exports.updatePlaylist = /** @type {const} */ ({
  params: playlistParams,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      description: { type: 'string' },
    },
  },
});

exports.renamePlaylist = /** @type {const} */ ({
  params: playlistParams,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
    },
    required: ['name'],
  },
});

exports.getPlaylistItems = /** @type {const} */ ({
  params: playlistParams,
  query: {
    type: 'object',
    if: {
      properties: { page: true },
    },
    then: {
      oneOf: [
        { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/Pagination' },
        { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/LegacyPagination' },
      ],
    },
  },
});

exports.addPlaylistItems = /** @type {const} */ ({
  params: playlistParams,
  body: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sourceType: { type: 'string' },
            sourceID: {
              oneOf: [{ type: 'string' }, { type: 'number' }],
            },
            artist: { type: 'string' },
            title: { type: 'string' },
          },
          required: ['sourceType', 'sourceID', 'artist', 'title'],
        },
      },
    },
    required: ['items'],

    // Different ways to describe the insert position
    oneOf: [
      {
        type: 'object',
        properties: {
          after: {
            oneOf: [
              { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
              { const: null },
              { const: -1 },
            ],
          },
        },
        required: ['after'],
      },
      {
        type: 'object',
        properties: {
          at: { enum: ['start', 'end'] },
        },
        required: ['at'],
      },
    ],
  },
});

exports.removePlaylistItems = /** @type {const} */ ({
  params: playlistParams,
  body: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
      },
    },
    required: ['items'],
  },
});

exports.movePlaylistItems = /** @type {const} */ ({
  params: playlistParams,
  body: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
      },
    },
    required: ['items'],
    // Different ways to describe the insert position
    oneOf: [
      {
        type: 'object',
        properties: {
          after: {
            oneOf: [
              { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
              { const: null },
              { const: -1 },
            ],
          },
        },
        required: ['after'],
      },
      {
        type: 'object',
        properties: {
          at: { enum: ['start', 'end'] },
        },
        required: ['at'],
      },
    ],
  },
});

exports.shufflePlaylistItems = /** @type {const} */ ({
  params: playlistParams,
});

exports.getPlaylistItem = /** @type {const} */ ({
  params: playlistItemParams,
});

exports.updatePlaylistItem = /** @type {const} */ ({
  params: playlistItemParams,
  body: {
    type: 'object',
    properties: {
      artist: { type: 'string' },
      title: { type: 'string' },
      start: { type: 'integer', minimum: 0 },
      end: { type: 'integer', minimum: 0 },
    },
  },
});

exports.removePlaylistItem = /** @type {const} */ ({
  params: playlistItemParams,
});

// Validations for search routes:

exports.searchAll = /** @type {const} */ ({
  query: {
    type: 'object',
    properties: {
      query: { type: 'string' },
    },
    required: ['query'],
  },
});

exports.search = /** @type {const} */ ({
  query: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      include: { type: 'string', nullable: true },
    },
    required: ['query'],
  },
  params: {
    type: 'object',
    properties: {
      source: { type: 'string', minLength: 1 },
    },
    required: ['source'],
  },
});

// Validations for user routes:

const userParams = /** @type {const} */ ({
  type: 'object',
  properties: {
    id: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
  },
  required: ['id'],
});

exports.getUser = /** @type {const} */ ({
  params: userParams,
});

exports.muteUser = /** @type {const} */ ({
  params: userParams,
  body: {
    type: 'object',
    properties: {
      time: { type: 'integer', minimum: 0 },
    },
    required: ['time'],
  },
});

exports.unmuteUser = /** @type {const} */ ({
  params: userParams,
});

exports.addUserRole = /** @type {const} */ ({
  params: {
    type: 'object',
    properties: {
      id: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
      role: { type: 'string' },
    },
    required: ['id', 'role'],
  },
});

exports.removeUserRole = /** @type {const} */ ({
  params: {
    type: 'object',
    properties: {
      id: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
      role: { type: 'string' },
    },
    required: ['id', 'role'],
  },
});

exports.setUserName = /** @type {const} */ ({
  params: userParams,
  body: {
    type: 'object',
    properties: {
      username: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/Username' },
    },
    required: ['username'],
  },
});

exports.setUserAvatar = /** @type {const} */ ({
  params: userParams,
  body: {
    type: 'object',
    properties: {
      avatar: { type: 'string' },
    },
    required: ['avatar'],
  },
});

exports.setUserStatus = /** @type {const} */ ({
  params: userParams,
  body: {
    type: 'object',
    properties: {
      status: { type: 'integer' },
    },
    required: ['status'],
  },
});

exports.getUserHistory = /** @type {const} */ ({
  params: userParams,
  query: {
    oneOf: [
      { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/Pagination' },
      { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/LegacyPagination' },
      true,
    ],
  },
});

// Validations for Waitlist routes:

exports.joinWaitlist = /** @type {const} */ ({
  body: {
    type: 'object',
    properties: {
      userID: { $ref: 'https://ns.u-wave.net/schemas/definitions.json#/definitions/ObjectID' },
    },
    required: ['userID'],
  },
});

exports.moveWaitlist = /** @type {const} */ ({
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
});

exports.lockWaitlist = /** @type {const} */ ({
  body: {
    type: 'object',
    properties: {
      lock: { type: 'boolean' },
    },
    required: ['lock'],
  },
});
