import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import annotoo from '@staplelab/vite-plugin-annotoo';

export default defineConfig({
  // Relative base so the build works when hosted under any sub-path.
  base: './',
  plugins: [react(), annotoo()],
});
