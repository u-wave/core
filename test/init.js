import Bluebird from 'bluebird';
import chai from 'chai';
import asPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

Bluebird.config({
  longStackTraces: true,
  warnings: true
});

chai.use(asPromised);
chai.use(sinonChai);
