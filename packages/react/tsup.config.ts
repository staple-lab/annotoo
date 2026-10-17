import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  dts: true,
  target: 'es2020',
  clean: true,
  external: ['react', '@staplelab/annotoo'],
  // Next.js App Router: this component only runs on the client.
  banner: { js: '"use client";' },
});
