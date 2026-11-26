import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: [
    'eslint',
    'import',
    'jsdoc',
    'node',
    'typescript',
    'vitest',
    'promise',
  ],

  rules: {
    'jsdoc/require-property-description': 'off',
    // Mostly using `node:assert`
    'vitest/expect-expect': 'off',
  },
});
