// This file contains supporting types that can't be expressed in JavaScript/JSDoc.

import type { Model } from 'mongoose';
import type { ParsedQs } from 'qs';
import type { JsonObject } from 'type-fest';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type UwaveServer from './Uwave';
import type { HttpApi } from './HttpApi';
import type { User as UwaveUser } from './models';
import type { AuthenticateOptions } from './controllers/authenticate';

// Add üWave specific request properties.
declare global {
  namespace Express {
    interface Request {
      uwave: UwaveServer;
      uwaveHttp: HttpApi;
      /**
       * Only available while social signup is in progress.
       */
      pendingUser?: UwaveUser;
      /**
       * Only available in specific authentication routes.
       */
      authOptions?: AuthenticateOptions;
      fullUrl: string;
    }
  }
}

type DefaultParams = Record<string, string>;
type DefaultQuery = ParsedQs;
type DefaultBody = JsonObject;

/**
 * A possibly unauthenticated HTTP API request.
 */
export type Request<
  TParams = DefaultParams,
  TQuery = DefaultQuery,
  TBody = DefaultBody,
> = ExpressRequest<TParams, unknown, TBody, TQuery, never> & {
  user?: UwaveUser,
};

/**
 * A controller function that does not require authentication.
 */
export type Controller<
  TParams = DefaultParams,
  TQuery = DefaultQuery,
  TBody = DefaultBody,
> = (req: Request<TParams, TQuery, TBody>, res: ExpressResponse) => Promise<object>;

/**
 * An authenticated HTTP API request.
 */
export type AuthenticatedRequest<
  TParams = DefaultParams,
  TQuery = DefaultQuery,
  TBody = DefaultBody,
> = Request<TParams, TQuery, TBody> & {
  user: UwaveUser,
};

/**
 * A controller function that requires authentication.
 */
export type AuthenticatedController<
  TParams = DefaultParams,
  TQuery = DefaultQuery,
  TBody = DefaultBody,
> = (req: AuthenticatedRequest<TParams, TQuery, TBody>, res: ExpressResponse) => Promise<object>;

/**
 * Utility type that returns a Document<TSchema> given a Model<Document<TSchema>>.
 */
export type ToDocument<TModel extends Model<unknown>> =
  TModel extends Model<infer TDoc> ? TDoc : never;

type LegacyPaginationQuery = { page?: string, limit?: string };
type OffsetPaginationQuery = {
  page?: { offset?: string, limit?: string },
};
export type PaginationQuery = LegacyPaginationQuery | OffsetPaginationQuery;
