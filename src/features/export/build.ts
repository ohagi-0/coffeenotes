// エクスポート（F-MISC-2）。記録を CSV / JSON の文字列にする純粋関数。ダウンロードは platform/download.ts。
// Google の店（place_provider = 'google'）は、店名と Google マップへのリンク（place_id）だけを出し、住所・座標は出さない
// （Google から取った内容は place_id 以外を手元の写しとして配らない。ADR 0011）。
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
  'shop_map_url',
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

/** Google の店だけ、place_id から Google マップのリンクを作る。それ以外は null */
export function shopMapUrl(shop: LogWithRelations['shop']): string | null {
  if (shop?.place_provider !== 'google' || !shop.external_place_id) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name)}&query_place_id=${encodeURIComponent(shop.external_place_id)}`;
}

/** JSON 用: Google の店は住所を落とし、リンクを足す。手入力・OSM の店はそのまま */
function exportShop(shop: LogWithRelations['shop']) {
  if (!shop || shop.place_provider !== 'google') return shop;
  return { ...shop, address: null, shop_map_url: shopMapUrl(shop) };
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
    shop_map_url: shopMapUrl(l.shop),
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
    {
      exportedAt: new Date().toISOString(),
      app: 'coffeenotes',
      version: 1,
      logs: logs.map((l) => ({ ...l, shop: exportShop(l.shop) })),
    },
    null,
    2,
  );
}

export function exportFileName(ext: 'csv' | 'json', now = new Date()): string {
  return `coffeenotes-${now.toISOString().slice(0, 10)}.${ext}`;
}
