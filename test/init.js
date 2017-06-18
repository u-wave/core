import Bluebird from 'bluebird';
import chai from 'chai';
import asPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { Mockgoose } from 'mockgoose';
import mongoose from 'mongoose';

Bluebird.config({
  longStackTraces: true,
  warnings: true
});

chai.use(asPromised);
chai.use(sinonChai);

const mockgoose = new Mockgoose(mongoose);
before(async function prepareMockgoose() {
  // May have to download mongodb-prebuilt which can take a long time.
  this.timeout(0);
  await mockgoose.prepareStorage();
});
