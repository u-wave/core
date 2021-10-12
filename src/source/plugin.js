'use strict';

const has = require('has');
const debug = require('debug')('uwave:source');
const mergeAllOf = require('json-schema-merge-allof');
const { ModernSourceWrapper } = require('./Source');

/** @typedef {import('../Uwave')} Uwave} */
/** @typedef {import('./Source').SourcePluginV3} SourcePluginV3} */

/**
 * @param {Uwave} uw
 * @param {{ source: SourcePluginV3, baseOptions?: object }} options
 */
async function plugin(uw, { source: SourcePlugin, baseOptions = {} }) {
  debug('registering plugin', SourcePlugin);
  if (SourcePlugin.api !== 3) {
    uw.source(SourcePlugin, baseOptions);
    return;
  }

  if (!SourcePlugin.sourceName) {
    throw new TypeError('Source plugin does not provide a `sourceName`');
  }

  async function readdSource(options) {
    debug('adding plugin', options);
    const { enabled, ...sourceOptions } = options;

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

    const initialOptions = await uw.config.get(SourcePlugin.schema['uw:key']);
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

    await readdSource(initialOptions);
  } else {
    // The source does not support options
    await readdSource({});
  }
}

module.exports = plugin;
