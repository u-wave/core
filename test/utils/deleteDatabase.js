'use strict';

const mongoose = require('mongoose');
const delay = require('delay');

module.exports = async function deleteDatabase(url) {
  const defaultOptions = {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  };

  const mongo = mongoose.createConnection(url, defaultOptions);

  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < 10; i += 1) {
    try {
      await mongo.dropDatabase();
      break;
    } catch (error) {
      await delay(100);
    }
  }
  /* eslint-enable no-await-in-loop */

  await mongo.close();
};
