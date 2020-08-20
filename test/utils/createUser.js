'use strict';

const mongoose = require('mongoose');

let i = Date.now();
function createUser(uw) {
  const User = uw.model && uw.model('User');
  const props = {
    _id: new mongoose.Types.ObjectId(),
    username: `test_user_${i.toString(36)}`,
    slug: i.toString(36),
  };
  i += 1;
  if (User) {
    return new User(props);
  }
  return props;
}

module.exports = createUser;
