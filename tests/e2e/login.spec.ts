import { expect, test } from '@playwright/test';

// Phase 0 のスモーク: 未ログインでトップを開くとログイン画面に飛ぶ。
// Phase 1 で「ログイン → 手入力で記録作成 → タイムラインに表示」に拡張する（CLAUDE.md §5.4）。
test('未ログインならログイン画面が表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'coffeenotes' })).toBeVisible();
  await expect(page.getByLabel('メールアドレス')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Google でログイン' })).toBeVisible();
});
