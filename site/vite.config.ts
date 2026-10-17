import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import annotoo from '@staplelab/vite-plugin-annotoo';

// SITE_BASE lets the site be hosted under a sub-path, e.g. SITE_BASE=/annotoo/ pnpm build.
export default defineConfig({
  base: process.env.SITE_BASE ?? '/',
  plugins: [react(), annotoo()],
});
