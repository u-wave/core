import { promisify } from 'bluebird';
import chai from 'chai';
import asPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import mockgoose from 'mockgoose';
import mongoose from 'mongoose';

chai.use(asPromised);
chai.use(sinonChai);

beforeEach(async () => {
  await mockgoose(mongoose);
  await mongoose.connect('mongodb://localhost/test');
});
afterEach(async () => {
  // Clear mongoose state
  mongoose.models = {};
  mongoose.modelSchemas = {};
  await promisify(mongoose.unmock)();
});
