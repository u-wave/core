import { JsonValue } from 'type-fest';
import { PlaylistItemDesc } from '../plugins/playlists';
import Page from '../Page';
import SourceContext from './SourceContext';
import ImportContext from './ImportContext';

export interface SourcePluginV1 {
  api?: 1;
  get(ids: string[]): Promise<PlaylistItemDesc[]>;
  search(query: string, page: unknown, ...args: unknown[]): Promise<PlaylistItemDesc[]>;
}

export interface SourcePluginV2 {
  api: 2;
  get(context: SourceContext, ids: string[]): Promise<PlaylistItemDesc[]>;
  search(context: SourceContext, query: string, page: unknown, ...args: unknown[]): Promise<PlaylistItemDesc[]>;
  import?(context: ImportContext, ...args: unknown[]): Promise<unknown>;
}

export interface SourcePluginV3Instance<TPagination extends JsonValue> {
  get(context: SourceContext, ids: string[]): Promise<PlaylistItemDesc[]>;
  search(context: SourceContext, query: string, page?: JsonValue): Promise<Page<PlaylistItemDesc, TPagination>>;
  getUserPlaylists?(context: SourceContext, userID: string, page?: JsonValue): Promise<Page<unknown, TPagination>>;
  getPlaylistItems?(context: SourceContext, sourceID: string, page?: JsonValue): Promise<Page<PlaylistItemDesc, TPagination>>
}

export interface SourcePluginV3Statics<TOptions, TPagination extends JsonValue> {
  api: 3;
  sourceName: string;
  schema: JSONSchemaType<TOptions> & { 'uw:key': string };
  new(options: TOptions): SourcePluginV3Instance<TPagination>;
}

export type StaticSourcePlugin = SourcePluginV1 | SourcePluginV2;
export type HotSwappableSourcePlugin<TOptions, TPagination extends JsonValue> = SourcePluginV3Statics<TOptions, TPagination>;

export interface SourceWrapper {
  readonly apiVersion: number;
  readonly type: string;
  getOne(user: User, id: string): Promise<PlaylistItemDesc | undefined>;
  get(user: User, ids: string[]): Promise<PlaylistItemDesc[]>;
  search(user: User, query: string, page?: JsonValue): Promise<Page<PlaylistItemDesc, JsonValue>>;
  getUserPlaylists(user: User, userID: string): Promise<Page<unknown, JsonValue>>;
  getPlaylistItems(user: User, playlistID: string): Promise<Page<PlaylistItemDesc, JsonValue>>;
}
