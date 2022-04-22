// Contains typings for dependencies that do not have types.

declare module 'crypto-randomuuid' {
  // From https://github.com/DefinitelyTyped/DefinitelyTyped/blob/04843fe4de7d03161bf6e5f2b51c49b2cd21e96c/types/node/crypto.d.ts#L3019-L3035

  interface RandomUUIDOptions {
      /**
       * By default, to improve performance,
       * Node.js will pre-emptively generate and persistently cache enough
       * random data to generate up to 128 random UUIDs. To generate a UUID
       * without using the cache, set `disableEntropyCache` to `true`.
       *
       * @default `false`
       */
      disableEntropyCache?: boolean | undefined;
  }
  /**
   * Generates a random [RFC 4122](https://www.rfc-editor.org/rfc/rfc4122.txt) version 4 UUID. The UUID is generated using a
   * cryptographic pseudorandom number generator.
   */
  function randomUUID(options?: RandomUUIDOptions): string;
  export = randomUUID;
}
