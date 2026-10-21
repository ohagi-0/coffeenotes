import { describe, expect, it } from 'vitest';
import { buildFarm, cupsToNextStage, farmScene, treeStage } from '@/features/beans/farm';
import { cupsByCountry, type CollectionSourceLog } from '@/features/beans/collection';

const log = (id: string, country: string | null, logged_on = '2026-10-01'): CollectionSourceLog => ({
  id,
  logged_on,
  rating: 4,
  place: 'shop',
  bean: { id: `b-${id}`, name: 'X', country },
});
const NOW = new Date('2026-10-21T00:00:00Z');

describe('treeStage / farmScene', () => {
  it('1 / 3 / 6 / 10 杯で段階が上がる。次の段階までの杯数', () => {
    expect(treeStage(1)).toBe(1);
    expect(treeStage(2)).toBe(1);
    expect(treeStage(3)).toBe(2);
    expect(treeStage(6)).toBe(3);
    expect(treeStage(10)).toBe(4);
    expect(treeStage(40)).toBe(4);
    expect(cupsToNextStage(2)).toBe(1);
    expect(cupsToNextStage(6)).toBe(4);
    expect(cupsToNextStage(12)).toBeNull();
  });
  it('木の本数で 鉢 / 畑 / 丘', () => {
    expect(farmScene(0)).toBe('pot');
    expect(farmScene(2)).toBe('pot');
    expect(farmScene(3)).toBe('field');
    expect(farmScene(7)).toBe('field');
    expect(farmScene(8)).toBe('hill');
  });
});

describe('buildFarm', () => {
  it('産地ごとに 1 本、表記ゆれは同じ木。杯数で段階、直近 30 日に飲んだ国は花、実は杯数ぶん', () => {
    const logs = [
      ...Array.from({ length: 11 }, (_, i) => log(`c${i}`, i % 2 ? 'Colombia' : 'コロンビア', '2026-09-01')),
      log('e1', 'Ethiopia', '2026-10-15'),
      log('e2', 'エチオピア', '2026-10-18'),
      log('e3', 'Ethiopia', '2026-10-19'),
      log('k1', 'Kenya', '2026-08-01'),
      log('n1', null),
      log('t1', 'Timor-Leste', '2026-10-20'),
    ];
    const farm = buildFarm(logs, NOW);
    expect(farm.trees.map((t) => [t.key, t.cups, t.stage, t.flowering, t.cherries])).toEqual([
      ['colombia', 11, 4, false, 11],
      ['ethiopia', 3, 2, true, 0],
      ['kenya', 1, 1, false, 0],
      ['other:timor leste', 1, 1, true, 0],
    ]);
    expect(farm.trees[0]!.label).toBe('COLOMBIA');
    expect(farm.trees[3]!.label).toBe('TIMOR-LESTE');
    expect(farm.scene).toBe('field');
    expect(farm.flowering).toBe(2);
    expect(farm.totalCups).toBe(16);
  });
  it('同じ杯数は先に飲んだ順。記録が無ければ木は無く鉢', () => {
    const farm = buildFarm([log('a', 'Kenya', '2026-10-10'), log('b', 'Brazil', '2026-09-10')], NOW);
    expect(farm.trees.map((t) => t.key)).toEqual(['brazil', 'kenya']);
    expect(buildFarm([], NOW)).toEqual({ trees: [], scene: 'pot', flowering: 0, totalCups: 0 });
  });
  it('cupsByCountry は国のキーごとの杯数', () => {
    const m = cupsByCountry([
      log('1', 'Colombia'),
      log('2', 'コロンビア'),
      log('3', null),
      log('4', 'Kenya'),
    ]);
    expect(m.get('colombia')).toBe(2);
    expect(m.get('kenya')).toBe(1);
    expect(m.size).toBe(2);
  });
});
