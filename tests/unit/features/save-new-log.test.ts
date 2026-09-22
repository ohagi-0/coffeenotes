import { describe, expect, it, vi } from 'vitest';
import { saveNewLog, type SaveNewLogDeps } from '@/features/logs/save-new-log';

const BEAN = '11111111-1111-4111-8111-111111111111';
const fields = { place: 'shop' as const, logged_on: '2026-09-22', rating: 4, tag_names: [] };

function deps(): SaveNewLogDeps & { calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = { roaster: [], bean: [], shop: [], log: [], images: [] };
  return {
    calls,
    createRoaster: vi.fn(async (i) => (calls.roaster!.push(i), { id: 'r1' })),
    createBean: vi.fn(async (i) => (calls.bean!.push(i), { id: 'b1' })),
    createShop: vi.fn(async (i) => (calls.shop!.push(i), { id: 's1' })),
    createLog: vi.fn(async (i) => (calls.log!.push(i), { id: 'l1' })),
    saveBeanImages: vi.fn(async (...a) => {
      calls.images!.push(a);
    }),
  };
}

describe('saveNewLog', () => {
  it('候補や地図で決めた店は座標付きで作る', async () => {
    const d = deps();
    const r = await saveNewLog(
      { bean: { kind: 'existing', id: BEAN, name: 'X' } },
      {
        fields,
        shop: {
          id: null,
          name: ' KIELO ',
          address: '東京都',
          lat: 35.6,
          lng: 139.7,
          externalPlaceId: 'node/1',
        },
      },
      d,
    );
    expect(d.calls.shop![0]).toEqual({
      name: 'KIELO',
      address: '東京都',
      lat: 35.6,
      lng: 139.7,
      external_place_id: 'node/1',
    });
    expect(r.shopId).toBe('s1');
    expect(d.calls.log![0]).toMatchObject({ bean_id: BEAN, shop_id: 's1' });
  });
  it('既存の店はそのまま使い、自宅なら店を付けない', async () => {
    const d = deps();
    await saveNewLog(
      { bean: { kind: 'existing', id: BEAN, name: 'X' } },
      { fields, shop: { id: 's9', name: 'A' } },
      d,
    );
    expect(d.createShop).not.toHaveBeenCalled();
    expect(d.calls.log![0]).toMatchObject({ shop_id: 's9' });
    const d2 = deps();
    await saveNewLog(
      { bean: { kind: 'existing', id: BEAN, name: 'X' } },
      { fields: { ...fields, place: 'home' }, shop: { id: 's9', name: 'A' } },
      d2,
    );
    expect(d2.calls.log![0]).toMatchObject({ shop_id: null });
  });
  it('新しい豆はロースター → 豆 → 画像 → 記録の順で作り、ocr_raw と画像を渡す', async () => {
    const d = deps();
    const r = await saveNewLog(
      {
        bean: {
          kind: 'new',
          form: { name: 'B', source: 'purchased', flavor_notes: [] },
          roaster: { id: null, name: 'R' },
          images: { front: 'data:image/jpeg;base64,AAA' },
          ocrRaw: { id: 'msg' },
        },
      },
      { fields: { ...fields, place: 'home' }, shop: null },
      d,
    );
    expect(d.calls.roaster![0]).toEqual({ name: 'R' });
    expect(d.calls.bean![0]).toMatchObject({ name: 'B', roaster_id: 'r1', ocr_raw: { id: 'msg' } });
    expect(d.calls.images![0]).toEqual(['b1', { front: 'data:image/jpeg;base64,AAA' }]);
    expect(r.beanId).toBe('b1');
    expect(r.imageError).toBeUndefined();
  });
  it('画像の保存に失敗しても豆と記録は保存され、imageError が付く', async () => {
    const d = deps();
    d.saveBeanImages = vi.fn(async () => {
      throw new Error('storage down');
    });
    const r = await saveNewLog(
      {
        bean: {
          kind: 'new',
          form: { name: 'B', source: 'purchased', flavor_notes: [] },
          roaster: { id: 'r1', name: 'R' },
          images: { front: 'data:,' },
        },
      },
      { fields: { ...fields, place: 'home' }, shop: null },
      d,
    );
    expect(r.logId).toBe('l1');
    expect(r.imageError).toBe('storage down');
  });
});
