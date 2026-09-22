import { expect, test } from '@playwright/test';

// /api/ocr のスモーク: 未ログインでは 401 の JSON を返す（本文に code がある）。
test('/api/ocr は未ログインだと 401 の JSON を返す', async ({ request }) => {
  const res = await request.post('/api/ocr', {
    multipart: {
      front: { name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
    },
  });
  expect(res.status()).toBe(401);
  expect((await res.json()).error.code).toBe('unauthorized');
});

test('記録の入口に「カードを撮る」が出る（未ログインならログインへ）', async ({ page }) => {
  await page.goto('/logs/new');
  await expect(page).toHaveURL(/\/login$/);
});
