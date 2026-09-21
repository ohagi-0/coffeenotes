import { describe, expect, it } from 'vitest';
import {
  chipToFilters,
  formatBrewRatio,
  formatLogDetail,
  groupByDate,
  toTimelineItem,
  type TimelineItem,
} from '@/features/logs/presenters';
import type { LogWithRelations } from '@/features/logs/queries';

function log(over: Partial<LogWithRelations> = {}): LogWithRelations {
  return {
    id: 'log-1',
    user_id: 'u',
    bean_id: 'b',
    roast_id: null,
    shop_id: 's',
    kind: 'drank',
    place: 'shop',
    logged_on: '2026-09-21',
    rating: 4.5,
    brew_method: 'ハンドドリップ',
    grinder: null,
    grind_setting: null,
    dose_g: null,
    water_g: null,
    water_temp_c: null,
    brew_time_sec: null,
    recipe_memo: null,
    memo: null,
    purchased_grams: null,
    photo_path: null,
    created_at: '2026-09-21T00:00:00Z',
    updated_at: '2026-09-21T00:00:00Z',
    bean: {
      id: 'b',
      name: 'Lusitania Lime Geisha',
      country: 'Colombia',
      process: 'Lime infused',
      variety: 'Geisha',
      roaster_id: 'r',
      price_jpy: 3800,
      roaster: { id: 'r', name: 'KIELO COFFEE' },
      bean_images: [],
    },
    shop: { id: 's', name: 'KIELO COFFEE 蔵前', kind: 'cafe' },
    roast: null,
    log_tags: [],
    ...over,
  } as LogWithRelations;
}

describe('presenters', () => {
  it('chipToFilters はチップの値を useLogs の条件にする', () => {
    expect(chipToFilters('all')).toEqual({});
    expect(chipToFilters('rating4')).toEqual({ minRating: 4 });
    expect(chipToFilters('home')).toEqual({ place: 'home' });
    expect(chipToFilters('country:Colombia')).toEqual({ country: 'Colombia' });
    expect(chipToFilters('process:Natural')).toEqual({ process: 'Natural' });
  });

  it('formatBrewRatio は 1:15 の形。整数でなければ小数 1 桁、無ければ null', () => {
    expect(formatBrewRatio(15, 225)).toBe('1:15');
    expect(formatBrewRatio(15, 230)).toBe('1:15.3');
    expect(formatBrewRatio(null, 225)).toBeNull();
    expect(formatBrewRatio(0, 225)).toBeNull();
  });

  it('店の記録は飲み方だけ、自宅は器具 · 比率 · 湯温', () => {
    expect(formatLogDetail(log())).toBe('ハンドドリップ');
    expect(
      formatLogDetail(
        log({ place: 'home', shop_id: null, brew_method: 'V60', dose_g: 15, water_g: 225, water_temp_c: 92 }),
      ),
    ).toBe('V60 · 1:15 · 92 ℃');
    expect(formatLogDetail(log({ brew_method: null }))).toBeNull();
  });

  it('toTimelineItem は表示用の平らな型にする', () => {
    const item = toTimelineItem(log());
    expect(item).toMatchObject({
      id: 'log-1',
      loggedOn: '2026-09-21',
      beanName: 'Lusitania Lime Geisha',
      roasterName: 'KIELO COFFEE',
      country: 'Colombia',
      rating: 4.5,
      place: 'shop',
      shopName: 'KIELO COFFEE 蔵前',
      detail: 'ハンドドリップ',
      imageSrc: null,
    });
    expect(toTimelineItem(log({ place: 'home', shop: null })).place).toBe('home');
  });

  it('groupByDate は入力順のまま同じ日付をまとめる', () => {
    const mk = (id: string, loggedOn: string): TimelineItem => ({
      id,
      loggedOn,
      beanName: id,
      rating: null,
      place: 'shop',
    });
    const groups = groupByDate([mk('a', '2026-09-21'), mk('b', '2026-09-21'), mk('c', '2026-09-19')]);
    expect(groups.map((g) => [g.date, g.items.length])).toEqual([
      ['2026-09-21', 2],
      ['2026-09-19', 1],
    ]);
  });
});
