# u-wave-core

Single-room server library for üWave.

## Getting Started

For now, do this:

```bash
git clone git@github.com:u-wave/core.git u-wave-core
cd u-wave-core
npm install
# This will add a "global" link to the package, so it'll be easy to use
# in other packages (u-wave-api-v1, u-wave-web) during development:
npm link
```

No worries, once we're public & on NPM, you'll be able to do this instead!
:smile:

```bash
npm install u-wave-core
```

[TODO docs on like, actually using it, and not just installing]

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

[MIT](./LICENSE)
