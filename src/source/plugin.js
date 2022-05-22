'use strict';

const has = require('has');
const debug = require('debug')('uwave:source');
const mergeAllOf = require('json-schema-merge-allof');
const { ModernSourceWrapper } = require('./Source');

/** @typedef {import('../Uwave')} Uwave} */
/**
 * @template TOptions
 * @template {import('type-fest').JsonValue} TPagination
 * @typedef {import('./types').HotSwappableSourcePlugin<TOptions, TPagination>} HotSwappableSourcePlugin
 */

/**
 * @template TOptions
 * @template {import('type-fest').JsonValue} TPagination
 * @param {Uwave} uw
 * @param {{ source: HotSwappableSourcePlugin<TOptions, TPagination>, baseOptions?: TOptions }}
 *     options
 */
async function plugin(uw, { source: SourcePlugin, baseOptions }) {
  debug('registering plugin', SourcePlugin);
  if (SourcePlugin.api !== 3) {
    uw.source(SourcePlugin, baseOptions ?? {});
    return;
  }

  if (!SourcePlugin.sourceName) {
    throw new TypeError('Source plugin does not provide a `sourceName`');
  }

  /**
   * This function is used to tell the compiler that something is of the TOptions shape.
   * This will be safe if we ensure that source options never contain an `enabled` property…
   *
   * @param {unknown} options
   * @returns {asserts options is TOptions}
   */
  // eslint-disable-next-line no-unused-vars
  function forceTOptions(options) {}

  /**
   * @param {TOptions & { enabled: boolean }} options
   */
  async function readdSource(options) {
    debug('adding plugin', options);
    const { enabled, ...sourceOptions } = options;
    forceTOptions(sourceOptions);

    const oldSource = uw.removeSourceInternal(SourcePlugin.sourceName);
    if (oldSource && has(oldSource, 'close') && typeof oldSource.close === 'function') {
      await oldSource.close();
    }

    if (enabled) {
      const instance = new SourcePlugin({
        ...baseOptions,
        ...sourceOptions,
      });

      const source = new ModernSourceWrapper(uw, SourcePlugin.sourceName, instance);
      uw.insertSourceInternal(SourcePlugin.sourceName, source);
    }
  }

  if (SourcePlugin.schema) {
    if (!SourcePlugin.schema['uw:key']) {
      throw new TypeError('Option schema for media source does not specify an "uw:key" value');
    }

    uw.config.register(SourcePlugin.schema['uw:key'], mergeAllOf({
      allOf: [
        {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              title: 'Enabled',
              default: false,
            },
          },
          required: ['enabled'],
        },
        SourcePlugin.schema,
      ],
    }, { deep: false }));

    // NOTE this is wrong if the schema changes between versions :/
    /** @type {TOptions | undefined} */
    const initialOptions = (/** @type {unknown} */ await uw.config.get(SourcePlugin.schema['uw:key']));
    uw.config.on('set', (key, newOptions) => {
      if (key === SourcePlugin.schema['uw:key']) {
        readdSource(newOptions).catch((error) => {
          if (uw.options.onError) {
            uw.options.onError(error);
          } else {
            debug(error);
          }
        });
      }
    });

    // TODO(goto-bus-stop) correctly type the `undefined` case
    // @ts-ignore
    await readdSource(initialOptions);
  } else {
    // The source does not support options
    // TODO(goto-bus-stop) we still need to support enabling/disabling the source here, so this
    // probably can just use the same code path as above.
    // @ts-ignore
    await readdSource({});
  }
}

module.exports = plugin;
