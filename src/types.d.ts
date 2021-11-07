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

type DefaultParams = Record<string, string>;
type DefaultQuery = import('qs').ParsedQS;
type DefaultBody = import('type-fest').JsonObject;

/**
 * A possibly unauthenticated HTTP API request.
 */
export type Request<
  TParams = DefaultParams,
  TQuery = DefaultQuery,
  TBody = DefaultBody,
> = import('express').Request<TParams, unknown, TBody, TQuery, never> & {
  user?: import('./models').User,
};

/**
 * A controller function that does not require authentication.
 */
export type Controller<
  TParams = DefaultParams,
  TQuery = DefaultQuery,
  TBody = DefaultBody,
> = (req: Request<TParams, TQuery, TBody>, res: import('express').Response) => Promise<object>;

/**
 * An authenticated HTTP API request.
 */
export type AuthenticatedRequest<
  TParams = DefaultParams,
  TQuery = DefaultQuery,
  TBody = DefaultBody,
> = Request<TParams, TQuery, TBody> & {
  user: import('./models').User,
};

/**
 * A controller function that requires authentication.
 */
export type AuthenticatedController<
  TParams = DefaultParams,
  TQuery = DefaultQuery,
  TBody = DefaultBody,
> = (req: AuthenticatedRequest<TParams, TQuery, TBody>, res: import('express').Response) => Promise<object>;

/**
 * Utility type that returns a Document<TSchema> given a Model<Document<TSchema>>.
 */
export type ToDocument<TModel extends Model<unknown>> =
  TModel extends Model<infer TDoc> ? TDoc : never;
