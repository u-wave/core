import { expect } from 'chai';
import mongoose from 'mongoose';
import uwave from '../src';
import Source from '../src/Source';

describe('Media Sources', () => {
  let server;
  beforeEach(() => {
    server = uwave({
      mongo: mongoose.createConnection('mongodb://localhost:27017/uw_test_sources'),
      useDefaultPlugins: false,
    });
  });
  afterEach(async () => {
    await server.stop();
  });

  const testSourceObject = {
    name: 'test-source',
    async search(query) {
      return [{ sourceID: query }];
    },
    async get(ids) {
      return ids.map(sourceID => ({ sourceID }));
    },
  };

  const testSource = () => {
    const search = async query => [{ sourceID: query }];
    const get = async ids => ids.map(sourceID => ({ sourceID }));
    return {
      name: 'test-source',
      search,
      get: get, // eslint-disable-line object-shorthand
    };
  };

  it('should register sources from objects', () => {
    server.source(testSourceObject);
    expect(server.source('test-source')).to.be.instanceOf(Source);
  });
  it('should register sources from a factory function', () => {
    server.source(testSource);
    expect(server.source('test-source')).to.be.instanceOf(Source);
  });

  it('should respond to search(query) API calls', () => {
    server.source(testSource);
    const query = 'search-query';
    return expect(server.source('test-source').search(null, query)).to.eventually.eql([
      { sourceType: 'test-source', sourceID: query },
    ]);
  });

  it('should respond to get(ids) API calls', () => {
    server.source(testSource);
    return expect(server.source('test-source').get(null, ['one', 'two'])).to.eventually.eql([
      { sourceType: 'test-source', sourceID: 'one' },
      { sourceType: 'test-source', sourceID: 'two' },
    ]);
  });

  it('should relay getOne(id) API calls to get()', () => {
    const id = 'media-id';
    let getCalled = false;
    server.source({
      name: 'test-source',
      async get(ids) {
        expect(ids).to.eql([id]);
        getCalled = true;
        return ids.map(sourceID => ({ sourceID }));
      },
    });

    expect(getCalled).to.equal(false);

    const promise = server.source('test-source').getOne(null, id);

    expect(getCalled).to.equal(true);

    return expect(promise).to.eventually.eql({ sourceType: 'test-source', sourceID: id });
  });
});
