// This file contains supporting types that can't be expressed in JavaScript/JSDoc.

import { Model } from 'mongoose';

// Add üWave specific request properties.
declare global {
  namespace Express {
    interface Request {
      uwave: import('./Uwave');
      fullUrl: string;
    }
  }
}

export type Request = import('express').Request & {
  user?: import('./models').User,
};

/**
 * Utility type that returns a Document<TSchema> given a Model<Document<TSchema>>.
 */
export type ToDocument<TModel extends Model<any>> =
  TModel extends Model<infer TDoc> ? TDoc : never;
