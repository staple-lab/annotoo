import { defineConfig, devices } from '@playwright/test';

const example = 'examples/vite-react';
const testEnvironment = {
  ANNOTOO_COMMENTS_DIR: '.annotoo.comments-e2e',
  // Scope fixture identity to test servers; never change the developer's Git configuration.
  GIT_CONFIG_COUNT: '2',
  GIT_CONFIG_KEY_0: 'user.name',
  GIT_CONFIG_VALUE_0: 'Annotoo test author',
  GIT_CONFIG_KEY_1: 'user.email',
  GIT_CONFIG_VALUE_1: 'annotoo-tests@example.invalid',
};

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
      env: testEnvironment,
    },
    {
      command: `pnpm --filter example-vite-react build && node e2e/serve-prefix.mjs ${example}/dist /s/my-proto/ 4318`,
      url: 'http://127.0.0.1:4318/s/my-proto/',
      reuseExistingServer: !process.env.CI,
      env: { ...testEnvironment, ANNOTOO_COMMENTS_DIR: '.annotoo.comments' },
    },
  ],
});
