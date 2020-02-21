module.exports = {
  admin: [
    '*',
  ],
  manager: [
    'moderator',
    'waitlist.clear',
    'chat.mention.everyone',
    'motd.set',
  ],
  moderator: [
    'user',
    'waitlist.add',
    'waitlist.remove',
    'waitlist.move',
    'waitlist.lock',
    'waitlist.join.locked',
    'booth.skip.other',
    'chat.delete',
    'chat.mute',
    'chat.unmute',
    'chat.mention.djs',
    'users.list',
    'users.bans.list',
    'users.bans.add',
    'users.bans.remove',
  ],
  special: [
    'user',
  ],
  user: [
    'waitlist.join',
    'waitlist.leave',
    'booth.skip.self',
    'booth.vote',
    'chat.send',
    'chat.mention.staff',
  ],
  guest: [],

  // Individual roles, only assigned to superusers via the '*' role by default.
  'acl.create': [],
  'acl.delete': [],
};
