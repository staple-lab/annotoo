import { defineConfig } from 'vitest/config';

// Library build: emit a single self-booting IIFE (`dist/notate.js`) with zero runtime
// dependencies. A post-build step (scripts/inline-self.mjs) embeds a copy of this bundle
// into itself so the "Bundle for Hub" export can produce a fully self-contained file.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'Notate',
      formats: ['iife'],
      fileName: () => 'notate.js',
    },
    minify: 'esbuild',
    target: 'es2020',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    include: ['**/*.test.ts'],
    globals: true,
  },
});
