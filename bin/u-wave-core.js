#!/usr/bin/env node

/* eslint-disable n/no-process-exit */
import fs from 'node:fs';
import explain from 'explain-error';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import ytSource from 'u-wave-source-youtube';
import scSource from 'u-wave-source-soundcloud';
import announce from 'u-wave-announce';
import minimist from 'minimist';
import uwave from '../src/index.js';
import emotes from '../src/plugins/emotes.js';

const pkg = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const argv = minimist(process.argv.slice(2));

const ajv = new Ajv({
  removeAdditional: true,
  used: true,
  coerceTypes: true,
  allErrors: true,
  formats: {
    hexadecimal: /^[0-9a-fA-F]+$/,
  },
});
addFormats(ajv);

const envSchema = {
  type: 'object',
  required: ['SECRET'],
  properties: {
    PORT: {
      type: 'number',
      default: 6042,
      description: 'Port to listen on.',
    },
    MONGODB_URL: {
      type: 'string',
      format: 'uri',
      description: 'Only for migrations.',
    },
    REDIS_URL: {
      type: 'string',
      format: 'uri',
      default: 'redis://localhost:6379',
      description: 'URL of the Redis instance to connect to.',
    },
    SQLITE_PATH: {
      type: 'string',
      default: 'uwave.sqlite',
      description: 'Path to the database file.',
    },
    SECRET: {
      type: 'string',
      format: 'hexadecimal',
      minLength: 64,
      maxLength: 64,
      description: 'A secret key used for encrypting passwords. Must be a 64-character hexadecimal string (= 256 bits).',
    },
    YOUTUBE_API_KEY: {
      type: 'string',
      description: 'Your YouTube Data API key.',
    },
    EXPERIMENTAL_EMOTES: {
      type: 'boolean',
    },
    TRUST_PROXY: {
      description: 'Required when using a reverse proxy like Nginx. See https://expressjs.com/en/5x/api.html#trust.proxy.options.table',
      anyOf: [{ type: 'number' }, { type: 'boolean' }, { type: 'string' }],
    },

    SMTP_HOSTNAME: {
      type: 'string',
    },
    SMTP_PORT: {
      type: 'number',
      default: 465,
    },
    SMTP_USERNAME: {
      type: 'string',
    },
    SMTP_PASSWORD: {
      type: 'string',
    },
  },
};

const config = { ...process.env };
const validConfig = ajv.validate(envSchema, config);

if (argv.h || argv.help || !validConfig) {
  console.log('u-wave-core');
  console.log('Version', pkg.version);
  console.log();
  console.log('Environment Variables:');
  console.log('  SECRET');
  console.log(`    ${envSchema.properties.SECRET.description}`);
  console.log('  PORT');
  console.log(`    ${envSchema.properties.PORT.description} Defaults to ${envSchema.properties.PORT.default}.`);
  console.log('  TRUST_PROXY');
  console.log(`    ${envSchema.properties.TRUST_PROXY.description}`);
  console.log('  SQLITE_PATH');
  console.log(`    ${envSchema.properties.SQLITE_PATH.description} Defaults to ${envSchema.properties.SQLITE_PATH.default}.`);
  console.log('  REDIS_URL');
  console.log(`    ${envSchema.properties.REDIS_URL.description} Defaults to ${envSchema.properties.REDIS_URL.default}.`);
  console.log('  YOUTUBE_API_KEY [optional]');
  console.log(`    ${envSchema.properties.YOUTUBE_API_KEY.description}`);
  console.log('  SMTP_HOSTNAME, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD [optional]');
  console.log('    Configures sending transactional emails, to allow users to request password resets');
  console.log();
}

if (argv.h || argv.help) {
  process.exit(0);
} else if (!validConfig) {
  ajv.errors.forEach((error) => {
    const { keyword, params } = error;
    switch (keyword) {
      case 'required':
        console.error(`⚠️ Missing environment variable ${params.missingProperty}`);
        break;
      default:
        console.error(`⚠️ Environment variable ${error.dataPath.slice(1)} ${error.message}`);
        break;
    }
  });
  process.exit(1);
}

const port = Number(argv.port || config.PORT);

const secret = Buffer.from(config.SECRET, 'hex');

let trustProxy = config.TRUST_PROXY;
if (trustProxy === 'true') {
  trustProxy = true;
} else if (trustProxy === 'false') {
  trustProxy = false;
} else if (/^\d+/.test(trustProxy)) {
  trustProxy = Number(trustProxy);
}

/** @type {undefined | import('nodemailer').TransportOptions} */
let smtpSettings;
if (config.SMTP_HOSTNAME) {
  smtpSettings = {
    host: config.SMTP_HOSTNAME,
    port: Number(config.SMTP_PORT),
    secure: config.SMTP_PORT === '465', // Maybe make this configurable individually in the future
  };

  if (config.SMTP_USERNAME) {
    smtpSettings.auth = {
      user: config.SMTP_USERNAME,
      pass: config.SMTP_PASSWORD,
    };
  }
}

const uw = uwave({
  port,
  redis: config.REDIS_URL,
  sqlite: config.SQLITE_PATH,
  secret,
  // This property is untyped, it is propagated to the also-untyped MongoDB -> SQL migration
  mongo: config.MONGODB_URL,
  trustProxy,
  mailTransport: smtpSettings,
});

uw.on('redisError', (err) => {
  throw explain(err, 'Could not connect to the Redis server. Is it installed and running?');
});

uw.use(announce);

if (config.EXPERIMENTAL_EMOTES) {
  console.warn('Using experimental third-party emotes integration');
  uw.use(emotes);
}

if (config.YOUTUBE_API_KEY) {
  uw.source(ytSource, {
    key: config.YOUTUBE_API_KEY,
  });
}
uw.source(scSource);

uw.listen(port).then(() => {
  console.log(`Now listening on ${port}`);
}, (error) => {
  console.error(error.stack);
  process.exit(1);
});

process.once('SIGINT', () => {
  /** @type {import('../src/Uwave.js').Boot} */ (uw).close((err) => {
    if (err != null) {
      console.error(err);
      process.exitCode = 1;
    }
  });
});
