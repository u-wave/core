import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['./test/*.{js,cjs,mjs}'],
    coverage: {
      include: ['./src/**/*.{js,cjs,mjs}'],
      enabled: true,
      provider: 'v8',
      reporter: ['lcov'],
    },
  },
});
