import { once } from 'events';
import mongoose from 'mongoose';
import delay from 'delay';

const IN_PROGRESS_ERROR = 12586;

export default async function deleteDatabase(url) {
  const defaultOptions = {};

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
}
