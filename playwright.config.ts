import { defineConfig, devices } from '@playwright/test';

const example = 'examples/vite-react';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 820 } },
  webServer: [
    {
      command: `pnpm --filter example-vite-react exec vite --port 5318 --strictPort`,
      url: 'http://localhost:5318/',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm --filter example-vite-react build && node e2e/serve-prefix.mjs ${example}/dist /s/my-proto/ 4318`,
      url: 'http://127.0.0.1:4318/s/my-proto/',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
