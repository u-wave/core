# u-wave-core

Core library for üWave, the collaborative listening platform.

[Getting Started](#getting-started) - [API](#api) - [Building](#contributing) -
[License](#license)

> Note: üWave is still under development. Particularly the `u-wave-core` and
> `u-wave-api-v1` modules will change a lot before the "official" 1.0.0 release.
> Make sure to always upgrade both of them at the same time.

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

## Contributing

### Building

The build step compiles the futuristic JavaScript that's used in this repository
to code that can be used in engines today, using Babel. To compile the code,
run:

```bash
npm run build
```

That's inconvenient if it has to be done manually each time you make a change.
Instead, there's the `watch` command that will automatically recompile files:

```bash
npm run watch
```

## License

[MIT][]

[Mongoose]: http://mongoosejs.com/
[IORedis]: https://github.com/luin/ioredis
[u-wave-source keyword]: https://www.npmjs.com/browse/keyword/u-wave-source

[example]: example/
[MIT]: ./LICENSE
