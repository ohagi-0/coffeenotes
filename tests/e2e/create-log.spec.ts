import { expect, test, type Page } from '@playwright/test';
import { e2eCredentials } from './env';

// Phase 1 の完了条件（CLAUDE.md §5.4、Issue #24）:
//   ログイン → 「＋ 記録する」→ 手で入力する → 豆名・ロースター → 次へ → 自宅で・星・メモ → 保存する
//   → 「保存しました」→ 豆詳細 → 入力記録一覧に豆名が出る。
// ログインはマジックリンクを自動化できないので、開発ビルドだけが持つ window.__coffeenotes.supabase で
// signInWithPassword を呼ぶ（src/components/dev-test-hooks.tsx）。資格情報が無ければ skip。

const creds = e2eCredentials();
const beanName = `E2E Geisha ${Date.now()}`;
const roasterName = `E2E Roastery ${Date.now()}`;

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

/** テストで作った記録・豆・ロースターを消す（RLS で自分の行だけ消える） */
async function cleanup(page: Page) {
  await page.evaluate(
    async ([bean, roaster]) => {
      const sb = window.__coffeenotes!.supabase;
      const beans = await sb.from('beans').select('id').eq('name', bean);
      for (const b of beans.data ?? []) {
        await sb.from('logs').delete().eq('bean_id', b.id);
        await sb.from('beans').delete().eq('id', b.id);
      }
      await sb.from('roasters').delete().eq('name', roaster);
    },
    [beanName, roasterName] as const,
  );
}

test.describe('記録作成の主要フロー', () => {
  test.skip(!creds, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD を .env.local に設定してください');

  test.afterEach(async ({ page }) => {
    if (creds) await cleanup(page);
  });

  test('ログイン → 手入力で記録作成 → 入力記録一覧に表示', async ({ page }) => {
    await signIn(page, creds!.email, creds!.password);
    await expect(page.getByRole('heading', { name: '入力記録一覧' })).toBeVisible();

    await page.getByRole('link', { name: '記録する' }).click();
    await expect(page.getByRole('heading', { name: '記録を追加' })).toBeVisible();
    await page.getByRole('link', { name: /手で入力する/ }).click();

    await expect(page.getByRole('heading', { name: '豆の情報' })).toBeVisible();
    await page.getByLabel('豆名').fill(beanName);
    await page.getByLabel('ロースター').fill(roasterName);
    await page.getByRole('button', { name: '次へ：どこで飲んだ？' }).click();

    await expect(page.getByRole('heading', { name: 'どこで、どうだった？' })).toBeVisible();
    await page.getByRole('radio', { name: '自宅で' }).click();
    const stars = page.getByRole('slider', { name: '評価' });
    await stars.focus();
    await page.keyboard.press('End'); // 5.0
    await page.keyboard.press('ArrowLeft'); // 4.5
    await page.getByLabel('メモ').fill('E2E: 自宅で淹れた');
    await page.getByRole('button', { name: '保存する' }).click();

    await expect(page.getByText('保存しました')).toBeVisible();
    // 保存後は豆詳細（/beans?id=）へ（#20）。豆名と 1 回目の記録が出る
    await expect(page).toHaveURL(/\/beans\?id=/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(beanName);
    await expect(page.getByText('1 回')).toBeVisible();

    // 入力記録一覧にも出る
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '入力記録一覧' })).toBeVisible();
    const row = page.getByRole('link', { name: new RegExp(beanName) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('4.5');
    await expect(row).toContainText('自宅');
  });
});
