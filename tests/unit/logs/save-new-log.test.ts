import { describe, expect, it, vi } from 'vitest';
import { saveNewLog, type LogFormDraft, type SaveNewLogDeps } from '@/features/logs/save-new-log';
import type { NewLogDraft } from '@/features/logs/new-log-draft';

function deps() {
  const d: SaveNewLogDeps = {
    createRoaster: vi.fn(async () => ({ id: 'roaster-new' })),
    createBean: vi.fn(async () => ({ id: 'bean-new' })),
    createShop: vi.fn(async () => ({ id: 'shop-new' })),
    createLog: vi.fn(async () => ({ id: 'log-new' })),
  };
  return d;
}

const newBean: NewLogDraft = {
  bean: {
    kind: 'new',
    form: { name: 'Geisha', source: 'purchased', flavor_notes: [] },
    roaster: { id: null, name: 'KIELO COFFEE' },
  },
};

const baseLog: LogFormDraft = {
  fields: { place: 'shop', kind: 'drank', logged_on: '2026-09-22', rating: 4.5, memo: 'good', tag_names: [] },
  shop: { id: null, name: '  KIELO 蔵前 ' },
};

describe('saveNewLog', () => {
  it('新しい豆 + 新しいロースター + 手入力の店: ロースター → 豆 → 店 → 記録 の順に作る', async () => {
    const d = deps();
    const r = await saveNewLog(newBean, baseLog, d);
    expect(d.createRoaster).toHaveBeenCalledWith({ name: 'KIELO COFFEE' });
    expect(d.createBean).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Geisha', roaster_id: 'roaster-new' }),
    );
    expect(d.createShop).toHaveBeenCalledWith({ name: 'KIELO 蔵前' });
    expect(d.createLog).toHaveBeenCalledWith(
      expect.objectContaining({ bean_id: 'bean-new', shop_id: 'shop-new', rating: 4.5, place: 'shop' }),
    );
    expect(r).toEqual({ beanId: 'bean-new', logId: 'log-new', shopId: 'shop-new' });
  });

  it('既存の豆と既存の店なら何も作らず記録だけ', async () => {
    const d = deps();
    await saveNewLog(
      { bean: { kind: 'existing', id: 'bean-1', name: 'x' } },
      { ...baseLog, shop: { id: 'shop-1', name: 'KIELO' } },
      d,
    );
    expect(d.createRoaster).not.toHaveBeenCalled();
    expect(d.createBean).not.toHaveBeenCalled();
    expect(d.createShop).not.toHaveBeenCalled();
    expect(d.createLog).toHaveBeenCalledWith(
      expect.objectContaining({ bean_id: 'bean-1', shop_id: 'shop-1' }),
    );
  });

  it('ロースターに id があれば作らない。自宅なら店を付けない', async () => {
    const d = deps();
    await saveNewLog(
      { bean: { ...newBean.bean, roaster: { id: 'roaster-1', name: 'KIELO' } } },
      { fields: { ...baseLog.fields, place: 'home' }, shop: { id: 'shop-1', name: 'x' } },
      d,
    );
    expect(d.createRoaster).not.toHaveBeenCalled();
    expect(d.createBean).toHaveBeenCalledWith(expect.objectContaining({ roaster_id: 'roaster-1' }));
    expect(d.createShop).not.toHaveBeenCalled();
    expect(d.createLog).toHaveBeenCalledWith(expect.objectContaining({ place: 'home', shop_id: null }));
  });

  it('店で飲んだが店を選ばなければ shop_id は null', async () => {
    const d = deps();
    const r = await saveNewLog(newBean, { ...baseLog, shop: null }, d);
    expect(d.createShop).not.toHaveBeenCalled();
    expect(r.shopId).toBeNull();
  });

  it('途中で失敗したら例外がそのまま上がる（後続は呼ばれない）', async () => {
    const d = deps();
    d.createBean = vi.fn(async () => {
      throw new Error('insert failed');
    });
    await expect(saveNewLog(newBean, baseLog, d)).rejects.toThrow('insert failed');
    expect(d.createLog).not.toHaveBeenCalled();
  });
});
