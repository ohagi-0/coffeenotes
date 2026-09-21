import { expect, test } from '@playwright/test';

// Phase 0 のスモーク: 未ログインでトップを開くとログイン画面に飛ぶ。
// Phase 1 で「ログイン → 手入力で記録作成 → 入力記録一覧に表示」に拡張する（CLAUDE.md §5.4、Issue #24）。
test('未ログインならログイン画面が表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Coffeenotes' })).toBeVisible();
  await expect(page.getByLabel('メールアドレス')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Google で続ける' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ログインリンクを送る' })).toBeVisible();
});

test('メールアドレスが空なら送信せずエラーを出す', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'ログインリンクを送る' }).click();
  // Next.js のルートアナウンサーも role=alert を持つので、文言で絞る
  await expect(page.getByRole('alert').filter({ hasText: 'メールアドレス' })).toBeVisible();
});
