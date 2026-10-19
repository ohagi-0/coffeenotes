import { describe, expect, it } from 'vitest';
import { buildCsv, buildJson, csvCell, exportFileName } from '@/features/export/build';
import type { LogWithRelations } from '@/features/logs/queries';
import { qrTextToUrl } from '@/lib/image/qr';

const log = {
  id: 'l1',
  logged_on: '2026-09-22',
  place: 'home',
  kind: 'drank',
  rating: 4.5,
  memo: '甘い, "良い"\n2行目',
  brew_method: null,
  grinder: 'C40',
  grind_setting: '25',
  dose_g: 15,
  water_g: 225,
  water_temp_c: 92,
  brew_time_sec: 180,
  recipe_memo: null,
  bean: {
    id: 'b1',
    name: 'Lusitania',
    country: 'Colombia',
    variety: 'Geisha',
    process: 'Lime infused',
    roaster: { id: 'r', name: 'KIELO' },
  },
  shop: null,
  roast: { id: 'x', roasted_on: '2026-09-01', roast_level: 'medium' },
  log_tags: [{ tag: { id: 't', name: '朝' } }, { tag: { id: 't2', name: 'ゲイシャ' } }],
} as unknown as LogWithRelations;

describe('csvCell', () => {
  it('カンマ・改行・引用符を含むときだけ引用する', () => {
    expect(csvCell('a')).toBe('a');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('');
    expect(csvCell(4.5)).toBe('4.5');
  });
});

describe('buildCsv / buildJson', () => {
  it('BOM 付き、ヘッダー + 行、タグは空白区切り', () => {
    const csv = buildCsv([log]);
    expect(csv.startsWith('﻿logged_on,place,kind,rating,bean_name')).toBe(true);
    const line = csv.split('\r\n')[1]!;
    expect(line).toContain('2026-09-22,home,drank,4.5,Lusitania,KIELO,Colombia,,Geisha,Lime infused,,');
    expect(line).toContain('"甘い, ""良い""\n2行目"');
    expect(line).toContain(',朝 ゲイシャ,2026-09-01,l1,b1');
  });
  it('JSON は記録の配列を含む', () => {
    const j = JSON.parse(buildJson([log]));
    expect(j.app).toBe('coffeenotes');
    expect(j.logs[0].id).toBe('l1');
  });
  it('ファイル名は日付付き', () => {
    expect(exportFileName('csv', new Date('2026-09-22T10:00:00Z'))).toBe('coffeenotes-2026-09-22.csv');
  });
});

describe('qrTextToUrl', () => {
  it('http(s) の URL だけを返す', () => {
    expect(qrTextToUrl('https://kielocoffee.com/lusitania')).toBe('https://kielocoffee.com/lusitania');
    expect(qrTextToUrl('mailto:a@b.c')).toBeNull();
    expect(qrTextToUrl('hello')).toBeNull();
    expect(qrTextToUrl(null)).toBeNull();
  });
});

describe('Google の店のエクスポート（ADR 0011）', () => {
  const withShop = (shop: unknown) => ({ ...log, shop }) as unknown as LogWithRelations;
  const google = {
    id: 's1',
    name: 'FUGLEN TOKYO',
    kind: 'cafe',
    address: '渋谷区富ケ谷１丁目１６−１１',
    place_provider: 'google',
    external_place_id: 'ChIJrWB6',
  };
  const col = (csv: string, name: string) => {
    const head = csv.replace('\uFEFF', '').split('\r\n');
    return head[1]!.split(',')[head[0]!.split(',').indexOf(name)];
  };

  it('CSV: Google の店は店名と shop_map_url だけ。住所・座標の列は無い', () => {
    const csv = buildCsv([withShop(google)]);
    expect(csv).not.toContain('渋谷区富ケ谷');
    expect(csv.split('\r\n')[0]).not.toMatch(/address|lat|lng/);
    expect(col(csv, 'shop')).toBe('FUGLEN TOKYO');
    expect(col(csv, 'shop_map_url')).toBe(
      'https://www.google.com/maps/search/?api=1&query=FUGLEN%20TOKYO&query_place_id=ChIJrWB6',
    );
  });

  it('CSV: 手入力・OSM の店・店なしは shop_map_url が空', () => {
    for (const shop of [
      { ...google, place_provider: null, external_place_id: null },
      { ...google, place_provider: 'osm', external_place_id: 'node/1' },
      null,
    ]) {
      expect(col(buildCsv([withShop(shop)]), 'shop_map_url')).toBe('');
    }
    expect(col(buildCsv([withShop({ ...google, place_provider: null })]), 'shop')).toBe('FUGLEN TOKYO');
  });

  it('JSON: Google の店は住所を落としてリンクを足す。手入力の店は従来どおり住所を残す', () => {
    const g = JSON.parse(buildJson([withShop(google)])).logs[0].shop;
    expect(g.address).toBeNull();
    expect(g.shop_map_url).toContain('query_place_id=ChIJrWB6');
    const manual = JSON.parse(
      buildJson([withShop({ ...google, place_provider: null, external_place_id: null })]),
    ).logs[0].shop;
    expect(manual.address).toBe('渋谷区富ケ谷１丁目１６−１１');
    expect(manual).not.toHaveProperty('shop_map_url');
  });
});
