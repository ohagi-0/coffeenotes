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
