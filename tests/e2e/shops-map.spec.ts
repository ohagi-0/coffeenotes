import { expect, test, type Page } from '@playwright/test';
import { e2eCredentials } from './env';

// 記録したお店（/shops）の地図（F-MAP-1、Issue #37 / #43）。座標つきで記録のある店を 2 件、記録のない店を 1 件作り、
// 地図の領域が出て、記録のある店の数だけピンがあり、記録のない店は折りたたみに入ることを確認する。NEXT_PUBLIC_MAP_PROVIDER が osm でも google でも同じ表示（role="img" + 店名）。
// 資格情報が無ければ skip。

const creds = e2eCredentials();
const stamp = Date.now();
const names = [`E2E Map Shop A ${stamp}`, `E2E Map Shop B ${stamp}`];
const idleName = `E2E Idle Shop ${stamp}`;
const beanName = `E2E Map Bean ${stamp}`;

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
    await page.evaluate(
      async ({ list, bean }) => {
        const sb = window.__coffeenotes!.supabase;
        const beans = await sb.from('beans').select('id').eq('name', bean);
        for (const b of beans.data ?? []) {
          await sb.from('logs').delete().eq('bean_id', b.id);
          await sb.from('beans').delete().eq('id', b.id);
        }
        await sb.from('shops').delete().in('name', list);
      },
      { list: [...names, idleName], bean: beanName },
    );
  });

  test('/shops に地図が出て、登録済みの店の数だけピンがある', async ({ page }) => {
    await signIn(page, creds!.email, creds!.password);
    await page.evaluate(
      async ([list, idle, bean]) => {
        const sb = window.__coffeenotes!.supabase;
        const { data } = await sb.auth.getUser();
        const uid = data.user!.id;
        const rows = (list as string[]).map((name, i) => ({
          user_id: uid,
          name,
          lat: 35.658 + i * 0.001,
          lng: 139.7016 + i * 0.001,
        }));
        const shops = await sb
          .from('shops')
          .insert([...rows, { user_id: uid, name: idle as string, lat: 35.66, lng: 139.71 }])
          .select('id, name');
        if (shops.error) throw new Error(shops.error.message);
        const b = await sb
          .from('beans')
          .insert({ user_id: uid, name: bean as string, source: 'purchased' })
          .select('id')
          .single();
        if (b.error) throw new Error(b.error.message);
        const logs = shops
          .data!.filter((s) => s.name !== idle)
          .map((s) => ({
            user_id: uid,
            bean_id: b.data.id,
            shop_id: s.id,
            place: 'shop',
            kind: 'drank',
            logged_on: '2026-10-01',
          }));
        const l = await sb.from('logs').insert(logs);
        if (l.error) throw new Error(l.error.message);
      },
      [names, idleName, beanName] as const,
    );

    await page.goto('/shops');
    await expect(page.getByRole('region', { name: '店の地図' })).toBeVisible({ timeout: 20_000 });
    for (const n of names) await expect(page.getByRole('img', { name: n })).toBeVisible({ timeout: 20_000 });
    // 記録のない店はピンにも一覧にも出ず、折りたたみの中（#43）
    await expect(page.getByRole('img', { name: idleName })).toHaveCount(0);
    await expect(page.getByText(idleName)).toHaveCount(0);
    await page.getByRole('button', { name: /まだ記録のない店/ }).click();
    await expect(page.getByText(idleName)).toBeVisible();
  });
});
