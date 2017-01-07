import chai from 'chai';
import asPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import mockgoose from 'mockgoose';
import mongoose from 'mongoose';

chai.use(asPromised);
chai.use(sinonChai);

before(async () => {
  await mockgoose(mongoose);
});
