import { defineConfig } from 'tsup';

export default defineConfig([
  // npm entry: explicit mount() API, consumed by every framework and plain JavaScript.
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    target: 'es2020',
    clean: true,
    sourcemap: true,
  },
  {
    entry: { vite: 'src/vite/index.ts' },
    format: ['esm'],
    dts: true,
    target: 'node18',
    platform: 'node',
  },
  // Script-tag entry: a single self-booting IIFE. scripts/inline-self.mjs then embeds a
  // copy of this bundle into itself so "Export HTML" can produce a self-contained file.
  {
    entry: { 'annotoo': 'src/iife.ts' },
    format: ['iife'],
    globalName: 'Annotoo',
    target: 'es2020',
    minify: true,
    outExtension: () => ({ js: '.js' }),
  },
]);
