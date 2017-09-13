import { expect } from 'chai';

import uwave from '../src';
import Source from '../src/Source';
import testConfig from './test-server-config.json';

describe('Media Sources', () => {
  let server;
  beforeEach(() => {
    server = uwave({
      ...testConfig,
      useDefaultPlugins: false
    });
  });

  const testSourceObject = {
    async search(query) {
      return [{ sourceID: query }];
    },
    async get(ids) {
      return ids.map(sourceID => ({ sourceID }));
    }
  };

  const testSource = () => {
    const search = async query => [{ sourceID: query }];
    const get = async ids => ids.map(sourceID => ({ sourceID }));
    return {
      search,
      get: get // eslint-disable-line object-shorthand
    };
  };

  it('should register sources from objects', () => {
    server.source('test-source', testSourceObject);
    expect(server.source('test-source')).to.be.instanceOf(Source);
  });
  it('should register sources from a factory function', () => {
    server.source('test-source', testSource);
    expect(server.source('test-source')).to.be.instanceOf(Source);
  });

  it('should respond to search(query) API calls', () => {
    server.source('test-source', testSource);
    const query = 'search-query';
    return expect(server.source('test-source').search(null, query)).to.eventually.eql([
      { sourceType: 'test-source', sourceID: query }
    ]);
  });

  it('should respond to get(ids) API calls', () => {
    server.source('test-source', testSource);
    return expect(server.source('test-source').get(null, ['one', 'two'])).to.eventually.eql([
      { sourceType: 'test-source', sourceID: 'one' },
      { sourceType: 'test-source', sourceID: 'two' }
    ]);
  });

  it('should relay getOne(id) API calls to get()', () => {
    const id = 'media-id';
    let getCalled = false;
    server.source('test-source', {
      async get(ids) {
        expect(ids).to.eql([id]);
        getCalled = true;
        return ids.map(sourceID => ({ sourceID }));
      }
    });

    expect(getCalled).to.equal(false);

    const promise = server.source('test-source').getOne(null, id);

    expect(getCalled).to.equal(true);

    return expect(promise).to.eventually.eql({ sourceType: 'test-source', sourceID: id });
  });
});
