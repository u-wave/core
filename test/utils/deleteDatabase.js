'use strict';

const { once } = require('events');
const mongoose = require('mongoose');
const delay = require('delay');

const IN_PROGRESS_ERROR = 12586;

module.exports = async function deleteDatabase(url) {
  const defaultOptions = {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  };

  const mongo = mongoose.createConnection(url, defaultOptions);
  await once(mongo, 'connected');

  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < 50; i += 1) {
    try {
      await mongo.dropDatabase();
      break;
    } catch (error) {
      if (error.code === IN_PROGRESS_ERROR) {
        // eslint-disable-next-line no-console
        console.log('database op in progress...waiting');
        await delay(100);
      } else {
        throw error;
      }
    }
  }
  /* eslint-enable no-await-in-loop */

  await mongo.close();
};
