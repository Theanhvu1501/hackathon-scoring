import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], fileParallelism: false },
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
});
