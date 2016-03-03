# u-wave-core

Single-room server library for üWave.

## Getting Started

For now, do this:

```
git clone git@github.com:goto-bus-stop/u-wave-core.git
cd u-wave-core
npm install
npm run build
# This will add a "global" link to the plugin, so it'll be easy to use in other
# packages (u-wave-api-v1, u-wave-web) during development:
npm link
```

No worries, once we're public & on NPM, you'll be able to do this instead!
:smile:

```
npm install u-wave-core
```

[TODO docs on like, actually using it, and not just installing]

## Contributing

### Building

The build step compiles the futuristic JavaScript that's used in this repository
to code that can be used in engines today, using Babel. To compile the code,
run:

```
npm run build
```

Note that you have to do this again every time you make a change to any
JavaScript file. It's a bit inconvenient--hopefully we can add NPM scripts for
commands/tools that make this easier :)

## License

[MIT](./LICENSE)
