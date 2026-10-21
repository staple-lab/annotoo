import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import annotoo from '@staplelab/annotoo/vite';

// SITE_BASE lets the site be hosted under a sub-path, e.g. SITE_BASE=/annotoo/ pnpm build.
export default defineConfig({
  base: process.env.SITE_BASE ?? '/',
  // The docs sandbox supplies its own browser-local storage and mount options.
  plugins: [react(), annotoo({ build: 'viewer', autoMount: false })],
});
