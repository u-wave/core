'use strict';

const { once } = require('events');
const mongoose = require('mongoose');

module.exports = async function deleteDatabase(url) {
  const defaultOptions = {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  };

  const mongo = mongoose.createConnection(url, defaultOptions);
  await once(mongo, 'connected');
  await mongo.dropDatabase();
  await mongo.close();
};
