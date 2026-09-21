import { defineConfig, devices } from '@playwright/test';

// E2E は主要フロー 1 本のみ維持する（CLAUDE.md §5.4）。スマホ幅（375px）を基準にする。
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
  webServer: {
    // dev サーバーは package.json で 3100 に固定している（3000 は他プロジェクトと衝突）
    command: 'pnpm dev',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
