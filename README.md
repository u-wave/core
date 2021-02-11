# u-wave-core

[Website](https://u-wave.net) - [Server List](https://hub.u-wave.net) -
[![Discord](https://img.shields.io/discord/809070303593496656?label=discord&style=flat-square)](https://discord.gg/8vsdfwS8tm)

The backend server for üWave, the collaborative listening platform.

[Dependencies](#dependencies) - [Development](#development) - [API](#api) -
[License](#license)

## Dependencies

üWave consists of two parts: the server (this repository) and the web client.
The server on its own only provides an HTTP API, so you must also run the web
client to actually use it.

üWave requires MongoDB and Redis databases.

## Development

The server can be run in development mode by:

```bash
git clone https://github.com/u-wave/core u-wave-core
cd u-wave-core
npm install
npm start
```

The development server reads configuration from a `.env` file in the root
of the repository.

```bash
# Database connection URLs.
REDIS_URL=redis://localhost:6379/
MONGODB_URL=mongodb://localhost:27017/uwave_dev

# Enables the YouTube media source if given.
YOUTUBE_API_KEY=your key
# Enables the SoundCloud media source if given.
SOUNDCLOUD_API_KEY=your key
```

## API

> You only need to use the API if you are integrating the üWave library with your
> own app.

API documentation is very incomplete and might change a lot before 1.0.0.
Take care!

See the [example/][example] directory for a usage example.

### uw = uwave(options={})

Create and start a üWave server.

**Parameters**

 - `mongo` - A MongoDB URL or [Mongoose][] connection instance.
 - `redis` - A Redis URL or [IORedis][] instance.

### uw.source(sourcePlugin, options={})

Add a media source plugin. Source plugins can be used to search and import media
from remote sources like YouTube or SoundCloud. Existing source plugins can be
found on npm with the [u-wave-source keyword][].

**Parameters**

 * `sourcePlugin` - Source plugin or plugin factory. Receives two parameters:
   The `uw` üWave Core instance, and the plugin options.
 * `options` - Options to pass to the source plugin.

### uw.close(): Promise

Stops the üWave server.

## License

[MIT][]

[Mongoose]: http://mongoosejs.com/
[IORedis]: https://github.com/luin/ioredis
[u-wave-source keyword]: https://www.npmjs.com/browse/keyword/u-wave-source

[example]: example/
[MIT]: ./LICENSE
