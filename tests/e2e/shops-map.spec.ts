import { expect, test, type Page } from '@playwright/test';
import { e2eCredentials } from './env';

// 記録したお店（/shops）の地図（F-MAP-1、Issue #37）。座標つきの店を 2 件作り、地図の領域が出て、
// 店の数だけピンがあることを確認する。NEXT_PUBLIC_MAP_PROVIDER が osm でも google でも同じ表示（role="img" + 店名）。
// 資格情報が無ければ skip。

const creds = e2eCredentials();
const stamp = Date.now();
const names = [`E2E Map Shop A ${stamp}`, `E2E Map Shop B ${stamp}`];

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForFunction(() => Boolean(window.__coffeenotes?.supabase));
  const result = await page.evaluate(
    async ([e, p]) => {
      const { error } = await window.__coffeenotes!.supabase.auth.signInWithPassword({
        email: e,
        password: p,
      });
      return error?.message ?? null;
    },
    [email, password] as const,
  );
  expect(result, 'signInWithPassword').toBeNull();
  await expect(page).toHaveURL(/\/$/);
}

test.describe('店の地図', () => {
  test.skip(!creds, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD を .env.local に設定してください');

  test.afterEach(async ({ page }) => {
    await page.evaluate(async (list) => {
      await window.__coffeenotes!.supabase.from('shops').delete().in('name', list);
    }, names);
  });

  test('/shops に地図が出て、登録済みの店の数だけピンがある', async ({ page }) => {
    await signIn(page, creds!.email, creds!.password);
    await page.evaluate(async (list) => {
      const sb = window.__coffeenotes!.supabase;
      const { data } = await sb.auth.getUser();
      const rows = list.map((name, i) => ({
        user_id: data.user!.id,
        name,
        lat: 35.658 + i * 0.001,
        lng: 139.7016 + i * 0.001,
      }));
      const { error } = await sb.from('shops').insert(rows);
      if (error) throw new Error(error.message);
    }, names);

    await page.goto('/shops');
    await expect(page.getByRole('region', { name: '店の地図' })).toBeVisible({ timeout: 20_000 });
    for (const n of names) await expect(page.getByRole('img', { name: n })).toBeVisible({ timeout: 20_000 });
  });
});
