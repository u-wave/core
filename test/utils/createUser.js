'use strict';

const mongoose = require('mongoose');

let i = Date.now();
async function createUser(uw) {
  const { User } = uw.models;
  const props = {
    _id: new mongoose.Types.ObjectId(),
    username: `test_user_${i.toString(36)}`,
    slug: i.toString(36),
  };
  i += 1;
  const user = new User(props);
  await user.save();
  return user;
}

module.exports = createUser;
