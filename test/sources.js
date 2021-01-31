'use strict';

const assert = require('assert');
const uwave = require('..');
const { Source } = require('../src/Source');
const deleteDatabase = require('./utils/deleteDatabase');

const DB_HOST = process.env.MONGODB_HOST || 'localhost';

describe('Media Sources', () => {
  let uw;
  beforeEach(async () => {
    uw = uwave({
      mongo: `mongodb://${DB_HOST}/uw_test_sources`,
      useDefaultPlugins: false,
      secret: Buffer.from('secret_test_sources'),
    });
    await uw.ready();
  });
  afterEach(async () => {
    await uw.close();
    await deleteDatabase(uw.options.mongo);
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
    assert(uw.source('test-source') instanceof Source);
  });
  it('should register sources from a factory function', () => {
    uw.source(testSource);
    assert(uw.source('test-source') instanceof Source);
  });

  it('should respond to search(query) API calls', async () => {
    uw.source(testSource);
    const query = 'search-query';
    const results = await uw.source('test-source').search(null, query);
    assert.deepStrictEqual(results, [
      { sourceType: 'test-source', sourceID: query },
    ]);
  });

  it('should respond to get(ids) API calls', async () => {
    uw.source(testSource);
    const results = await uw.source('test-source').get(null, ['one', 'two']);
    assert.deepStrictEqual(results, [
      { sourceType: 'test-source', sourceID: 'one' },
      { sourceType: 'test-source', sourceID: 'two' },
    ]);
  });

  it('should relay getOne(id) API calls to get()', async () => {
    const id = 'media-id';
    let getCalled = false;
    uw.source({
      name: 'test-source',
      async get(ids) {
        assert.deepStrictEqual(ids, [id]);
        getCalled = true;
        return ids.map((sourceID) => ({ sourceID }));
      },
    });

    assert.strictEqual(getCalled, false);

    const promise = uw.source('test-source').getOne(null, id);

    assert.strictEqual(getCalled, true);

    const results = await promise;
    assert.deepStrictEqual(results, { sourceType: 'test-source', sourceID: id });
  });
});
