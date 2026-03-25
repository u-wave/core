import { describe, it } from 'vitest';
import supertest from 'supertest';
import createUwave from './utils/createUwave.mjs';
import emotesPlugin from '../src/plugins/emotes';

describe('Emotes', () => {
  describe('GET /emotes', () => {
    it('is not found when emotes plugin is not used', async () => {
      await using uw = await createUwave('emotes');

      await supertest(uw.server)
        .get('/api/emotes')
        .expect(404);
    });

    it('does not require authentication', async () => {
      await using uw = await createUwave('emotes', {}, [emotesPlugin]);

      await supertest(uw.server)
        .get('/api/emotes')
        .expect(200);
    });
  });
});
