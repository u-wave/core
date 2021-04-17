import { JsonValue } from 'type-fest';
import { User } from './models';
import AuthedConnection from './sockets/AuthedConnection';

export type ClientActionParameters = {
  sendChat: string,
  vote: -1 | 1,
  logout: undefined,
};

export type ClientActions = {
  [Name in keyof ClientActionParameters]: (user: User, parameter: ClientActionParameters[Name], connection: AuthedConnection) => void
};
