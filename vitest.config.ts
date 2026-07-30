import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['app/**/*.test.ts', 'server/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
});
