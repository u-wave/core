import { createServer } from 'http';
import { expect } from 'chai';
import mongoose from 'mongoose';
import uwave from '../src';
import Source from '../src/Source';

describe('Media Sources', () => {
  let uw;
  beforeEach(() => {
    const server = createServer();
    uw = uwave({
      mongo: 'mongodb://localhost:27017/uw_test_sources',
      useDefaultPlugins: false,
      secret: Buffer.from('secret_test_sources'),
      server,
    });
    uw.on('stop', () => {
      server.close();
    });
  });
  afterEach(async () => {
    await uw.stop();
  });

  const testSourceObject = {
    name: 'test-source',
    async search(query) {
      return [{ sourceID: query }];
    },
    async get(ids) {
      return ids.map((sourceID) => ({ sourceID }));
    },
  };

  const testSource = () => {
    const search = async (query) => [{ sourceID: query }];
    const get = async (ids) => ids.map((sourceID) => ({ sourceID }));
    return {
      name: 'test-source',
      search,
      get: get, // eslint-disable-line object-shorthand
    };
  };

  it('should register sources from objects', () => {
    uw.source(testSourceObject);
    expect(uw.source('test-source')).to.be.instanceOf(Source);
  });
  it('should register sources from a factory function', () => {
    uw.source(testSource);
    expect(uw.source('test-source')).to.be.instanceOf(Source);
  });

  it('should respond to search(query) API calls', () => {
    uw.source(testSource);
    const query = 'search-query';
    return expect(uw.source('test-source').search(null, query)).to.eventually.eql([
      { sourceType: 'test-source', sourceID: query },
    ]);
  });

  it('should respond to get(ids) API calls', () => {
    uw.source(testSource);
    return expect(uw.source('test-source').get(null, ['one', 'two'])).to.eventually.eql([
      { sourceType: 'test-source', sourceID: 'one' },
      { sourceType: 'test-source', sourceID: 'two' },
    ]);
  });

  it('should relay getOne(id) API calls to get()', () => {
    const id = 'media-id';
    let getCalled = false;
    uw.source({
      name: 'test-source',
      async get(ids) {
        expect(ids).to.eql([id]);
        getCalled = true;
        return ids.map((sourceID) => ({ sourceID }));
      },
    });

    expect(getCalled).to.equal(false);

    const promise = uw.source('test-source').getOne(null, id);

    expect(getCalled).to.equal(true);

    return expect(promise).to.eventually.eql({ sourceType: 'test-source', sourceID: id });
  });
});
