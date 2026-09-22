// エクスポート（F-MISC-2）。記録を CSV / JSON の文字列にする純粋関数。ダウンロードは platform/download.ts。
import type { LogWithRelations } from '@/features/logs/queries';

export const EXPORT_COLUMNS = [
  'logged_on',
  'place',
  'kind',
  'rating',
  'bean_name',
  'roaster',
  'country',
  'region',
  'variety',
  'process',
  'shop',
  'brew_method',
  'grinder',
  'grind_setting',
  'dose_g',
  'water_g',
  'water_temp_c',
  'brew_time_sec',
  'recipe_memo',
  'memo',
  'tags',
  'roast_batch',
  'log_id',
  'bean_id',
] as const;

type Cell = string | number | null | undefined;

/** RFC 4180 に沿って 1 セルをエスケープ（カンマ・改行・引用符があれば引用） */
export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function logToExportRow(l: LogWithRelations): Record<(typeof EXPORT_COLUMNS)[number], Cell> {
  return {
    logged_on: l.logged_on,
    place: l.place,
    kind: l.kind,
    rating: l.rating,
    bean_name: l.bean.name,
    roaster: l.bean.roaster?.name ?? null,
    country: l.bean.country,
    region: null,
    variety: l.bean.variety,
    process: l.bean.process,
    shop: l.shop?.name ?? null,
    brew_method: l.brew_method,
    grinder: l.grinder,
    grind_setting: l.grind_setting,
    dose_g: l.dose_g,
    water_g: l.water_g,
    water_temp_c: l.water_temp_c,
    brew_time_sec: l.brew_time_sec,
    recipe_memo: l.recipe_memo,
    memo: l.memo,
    tags: l.log_tags
      .map((t) => t.tag?.name)
      .filter(Boolean)
      .join(' '),
    roast_batch: l.roast?.roasted_on ?? null,
    log_id: l.id,
    bean_id: l.bean.id,
  };
}

/** UTF-8 BOM 付き（Excel で文字化けしないため）、CRLF */
export function buildCsv(logs: readonly LogWithRelations[]): string {
  const lines = [EXPORT_COLUMNS.join(',')];
  for (const l of logs) {
    const row = logToExportRow(l);
    lines.push(EXPORT_COLUMNS.map((c) => csvCell(row[c])).join(','));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function buildJson(logs: readonly LogWithRelations[]): string {
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), app: 'coffeenotes', version: 1, logs },
    null,
    2,
  );
}

export function exportFileName(ext: 'csv' | 'json', now = new Date()): string {
  return `coffeenotes-${now.toISOString().slice(0, 10)}.${ext}`;
}
