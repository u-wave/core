import fs from 'node:fs';
import { FluentBundle, FluentResource } from '@fluent/bundle';

const en = new FluentBundle(['en-US', 'en']);
en.addResource(new FluentResource(
  fs.readFileSync(new URL('../locale/en.ftl', import.meta.url), 'utf8'),
));

/**
 * @param {string} id
 * @param {Record<string, import('@fluent/bundle').FluentVariable>} [args]
 */
export function t(id, args) {
  const message = en.getMessage(id);
  if (message == null || message.value == null) {
    throw new Error(`Translation "${id}" does not exist or is empty`);
  }
  return en.formatPattern(message.value, args);
}
