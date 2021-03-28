// This file contains supporting types that can't be expressed in JavaScript/JSDoc.

import { Model } from 'mongoose';

// Add üWave specific request properties.
declare global {
  namespace Express {
    interface Request {
      uwave: import('./Uwave');
      uwaveHttp: import('./HttpApi').HttpApi;
      /**
       * Only available while social signup is in progress.
       */
      pendingUser?: import('./models').User;
      /**
       * Only available in specific authentication routes.
       */
      authOptions?: import('./controllers/authenticate').AuthenticateOptions;
      fullUrl: string;
    }
  }
}

export type Request<
  TParams = Record<string, string>,
  TQuery = import('qs').ParsedQS,
  TBody = import('type-fest').JsonObject,
> = import('express').Request<TParams, any, TBody, TQuery, {}> & {
  user?: import('./models').User,
};

export type Controller<
  TParams = Record<string, string>,
  TQuery = import('qs').ParsedQS,
  TBody = import('type-fest').JsonObject,
> = (req: Request<TParams, TQuery, TBody>, res: import('express').Response) => Promise<object>;

/**
 * Utility type that returns a Document<TSchema> given a Model<Document<TSchema>>.
 */
export type ToDocument<TModel extends Model<any>> =
  TModel extends Model<infer TDoc> ? TDoc : never;
