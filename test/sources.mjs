import assert from 'assert';
import supertest from 'supertest';
import sinon from 'sinon';
import { LegacySourceWrapper } from '../src/source/Source.js';
import createUwave from './utils/createUwave.mjs';

describe('Media Sources', () => {
  let uw;
  beforeEach(async () => {
    uw = await createUwave('sources');
  });
  afterEach(async () => {
    await uw.destroy();
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

  function testSource() {
    const search = async (query) => [{ sourceID: query }];
    const get = async (ids) => ids.map((sourceID) => ({ sourceID }));
    return {
      name: 'test-source',
      search,
      get: get, // eslint-disable-line object-shorthand
    };
  }

  const testSourceWithPlayHook = {
    api: 2,
    name: 'test-source-with-play',
    async search() { throw new Error('unimplemented'); },
    async get() { throw new Error('unimplemented'); },
    async play(context, media) {
      return {
        urn: `${media.sourceType}:${media.sourceID}`,
      };
    },
  };

  it('should register sources from objects', () => {
    uw.source(testSourceObject);
    assert(uw.source('test-source') instanceof LegacySourceWrapper);
    assert.strictEqual(uw.source('test-source').apiVersion, 1);
  });
  it('should register sources from a factory function', () => {
    uw.source(testSource);
    assert(uw.source('test-source') instanceof LegacySourceWrapper);
    assert.strictEqual(uw.source('test-source').apiVersion, 1);
  });

  it('should respond to search(query) API calls', async () => {
    uw.source(testSource);
    const query = 'search-query';
    const results = await uw.source('test-source').search(null, query);
    assert.deepStrictEqual(results.data, [
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

  it('should respond to play(media) API calls', async () => {
    uw.source(testSourceWithPlayHook);
    const sourceData = await uw.source('test-source-with-play').play(null, {
      sourceID: '1234',
      sourceType: 'test-source-with-play',
    });
    assert.deepStrictEqual(sourceData, {
      urn: 'test-source-with-play:1234',
    });
  });

  describe('GET /search/:source', () => {
    it('should reject unauthenticated requests', async () => {
      uw.source(testSource);
      await supertest(uw.server)
        .get('/api/search/test-source')
        .send()
        .expect(401);
    });

    it('responds to an authenticated request', async () => {
      uw.source(testSource);

      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);

      const query = 'search-query';
      const results = await supertest(uw.server)
        .get('/api/search/test-source')
        .query({ query })
        .set('accept', 'application/json')
        .set('cookie', `uwsession=${token}`)
        .send()
        .expect(200);
      sinon.assert.match(results.body, {
        data: [
          { sourceType: 'test-source', sourceID: query },
        ],
      });
    });

    it('should reject requests for nonexistent sources', async () => {
      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);

      const res = await supertest(uw.server)
        .get('/api/search/garbage')
        .query({ query: 'garbage' })
        .set('accept', 'application/json')
        .set('cookie', `uwsession=${token}`)
        .send()
        .expect(404);

      sinon.assert.match(res.body.errors[0], {
        status: 404,
        code: 'source-not-found',
      });
    });

    it('should reject requests with invalid query data types', async () => {
      uw.source(testSource);

      const user = await uw.test.createUser();
      const token = await uw.test.createTestSessionToken(user);

      const res = await supertest(uw.server)
        .get('/api/search/test-source')
        .query({
          query: {
            some: 'garbage',
          },
        })
        .set('accept', 'application/json')
        .set('cookie', `uwsession=${token}`)
        .send()
        .expect(400);

      sinon.assert.match(res.body.errors[0], {
        status: 400,
        code: 'validation-error',
      });
    });
  });
});
