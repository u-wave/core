declare module 'fs-blob-store' {
  import { AbstractBlobStore } from 'abstract-blob-store';

  type Key = { key: string };
  type CreateCallback = (error: Error | null, metadata: Key) => void;

  class FsBlobStore implements AbstractBlobStore {
    constructor(basedir: string)

    createWriteStream(opts: Key, callback: CreateCallback): NodeJS.WriteStream

    createReadStream(opts: Key): NodeJS.ReadStream

    exists(opts: Key, callback: ExistsCallback): void

    remove(opts: Key, callback: RemoveCallback): void
  }

  export = FsBlobStore;
}
