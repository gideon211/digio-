import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The compiled build lives in dist/; never run specs from there.
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    environment: 'node',
  },
});
