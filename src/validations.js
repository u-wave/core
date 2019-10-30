import joi from '@hapi/joi';

const objectID = joi.string().length(24);
const userName = joi.string()
  .min(3).max(32)
  .pattern(/^[^\s\n]+$/);
const userEmail = joi.string().email();
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

export const register = joi.object({
  body: joi.object({
    email: userEmail.required(),
    username: userName.required(),
    password: userPassword.required(),
  }),
});

export const login = joi.object({
  query: joi.object({
    session: joi.string().valid('token', 'cookie').default('token'),
  }),
  body: joi.object({
    email: userEmail.required(),
    // This is less strict than the password validation used in `register`,
    // because we check this against the DB anyway, and an error message
    // about mismatching passwords makes more sense when logging in than an
    // error message about the password being too short.
    password: joi.string().required(),
  }),
});

export const requestPasswordReset = joi.object({
  body: joi.object({
    email: userEmail.required(),
  }),
});

export const passwordReset = joi.object({
  params: joi.object({
    reset: joi.string().required(),
  }),
  body: joi.object({
    password: userPassword.required(),
  }),
});

// Validations for ACL routes:

export const createAclRole = joi.object({
  params: joi.object({
    name: joi.string().required(),
  }),
  body: joi.object({
    permissions: joi.array().items(joi.string()).required(),
  }),
});

export const deleteAclRole = joi.object({
  params: joi.object({
    name: joi.string().required(),
  }),
});

// Validations for booth routes:

export const skipBooth = joi.object({
  body: joi.object({
    reason: joi.string().allow(''),
    userID: objectID,
    remove: joi.bool(),
  }).and('userID', 'reason'),
});

export const replaceBooth = joi.object({
  body: joi.object({
    userID: objectID.required(),
  }),
});

export const favorite = joi.object({
  body: joi.object({
    playlistID: objectID.required(),
    historyID: objectID.required(),
  }),
});

export const getRoomHistory = joi.object({
  query: pagination,
});

// Validations for chat routes:

export const deleteChatByUser = joi.object({
  params: joi.object({
    id: objectID.required(),
  }),
});

export const deleteChatMessage = joi.object({
  params: joi.object({
    id: joi.string().required(),
  }),
});

// Validations for MOTD routes:

export const setMotd = joi.object({
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

export const createPlaylist = joi.object({
  body: joi.object({
    name: joi.string().required(),
  }),
});

export const getPlaylist = joi.object({
  params: playlistParams,
});

export const deletePlaylist = joi.object({
  params: playlistParams,
});

export const updatePlaylist = joi.object({
  params: playlistParams,
  body: joi.object({
    name: joi.string(),
    shared: joi.bool(),
    description: joi.string(),
  }),
});

export const renamePlaylist = joi.object({
  params: playlistParams,
  body: joi.object({
    name: joi.string().required(),
  }),
});

export const sharePlaylist = joi.object({
  params: playlistParams,
  body: joi.object({
    shared: joi.bool().required(),
  }),
});

export const getPlaylistItems = joi.object({
  params: playlistParams,
  query: pagination,
});

export const addPlaylistItems = joi.object({
  params: playlistParams,
  body: joi.object({
    items: playlistItems.required(),
  }),
});

export const removePlaylistItems = joi.object({
  params: playlistParams,
  body: joi.object({
    items: playlistItemIDs.required(),
  }),
});

export const movePlaylistItems = joi.object({
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

export const shufflePlaylistItems = joi.object({
  params: playlistParams,
});

export const getPlaylistItem = joi.object({
  params: playlistItemParams,
});

export const updatePlaylistItem = joi.object({
  params: playlistItemParams,
  body: joi.object({
    artist: joi.string(),
    title: joi.string(),
    start: joi.number().min(0),
    end: joi.number().min(0),
  }),
});

export const removePlaylistItem = joi.object({
  params: playlistItemParams,
});

// Validations for user routes:

const userParams = joi.object({
  id: objectID.required(),
});

export const getUser = joi.object({
  params: userParams,
});

export const muteUser = joi.object({
  params: userParams,
  body: joi.object({
    time: joi.number().min(0).required(),
  }),
});

export const unmuteUser = joi.object({
  params: userParams,
});

export const addUserRole = joi.object({
  params: joi.object({
    id: objectID.required(),
    role: joi.string().required(),
  }),
});

export const removeUserRole = joi.object({
  params: joi.object({
    id: objectID.required(),
    role: joi.string().required(),
  }),
});

export const setUserName = joi.object({
  params: userParams,
  body: joi.object({
    username: userName,
  }),
});

export const setUserAvatar = joi.object({
  params: userParams,
  body: joi.object({
    avatar: joi.string(),
  }),
});

export const setUserStatus = joi.object({
  params: userParams,
  body: joi.object({
    status: joi.number(),
  }),
});

export const getUserHistory = joi.object({
  params: userParams,
  query: pagination,
});

// Validations for Waitlist routes:

export const joinWaitlist = joi.object({
  body: joi.object({
    userID: objectID.required(),
  }),
});

export const moveWaitlist = joi.object({
  body: joi.object({
    userID: objectID.required(),
    position: joi.number().min(0).required(),
  }),
});

export const lockWaitlist = joi.object({
  body: joi.object({
    lock: joi.bool().required(),
  }),
});
