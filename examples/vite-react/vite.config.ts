import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import annotoo from '@staplelab/annotoo/vite';

export default defineConfig({
  // Relative base so the build works when hosted under any sub-path.
  base: './',
  // This public demo includes a read-only viewer. Ordinary apps use annotoo().
  plugins: [react(), annotoo({ build: 'viewer', commentsDir: process.env.ANNOTOO_COMMENTS_DIR })],
});
