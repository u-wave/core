# u-wave-core

Core library for üWave, the collaborative listening platform.

[Getting Started](#getting-started) - [API](#api) - [Building](#contributing) -
[License](#license)

## Getting Started

üWave consists of three parts: the core library, the HTTP API, and the web
client.

See the [example/][example] directory for a usage example.

## API

API documentation is very incomplete and might change a lot before 1.0.0.
Take care!

### uw = uwave(options={})

Create and start a üWave server.

**Parameters**

 - `mongo` - A MongoDB URL or [Mongoose][] connection instance.
 - `redis` - A Redis URL or [IORedis][] instance.

### uw.source(sourceType, sourcePlugin, options={})

Add a media source plugin. Source plugins can be used to search and import media
from remote sources like YouTube or SoundCloud. Existing source plugins can be
found on npm with the [u-wave-source keyword][].

**Parameters**

 * `sourceType` - Source type name as a string. Used to signal where a given
   media item originated from.
 * `sourcePlugin` - Source plugin or plugin factory. Receives two parameters:
   The `uw` üWave Core instance, and the plugin options.
 * `options` - Options to pass to the source plugin. Only used if
   a source plugin factory was passed to `sourcePlugin`.

### uw.stop(): Promise

Stops the üWave server.

## License

[MIT][]

[Mongoose]: http://mongoosejs.com/
[IORedis]: https://github.com/luin/ioredis
[u-wave-source keyword]: https://www.npmjs.com/browse/keyword/u-wave-source

[example]: example/
[MIT]: ./LICENSE
