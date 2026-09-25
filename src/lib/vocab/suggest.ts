// 生産国・品種の入力候補（豆フォーム）。よくある名前（語彙の日本語名）と、自分が過去に入れた値を候補にする。
// ライト層が英語で打たなくて済むように、候補は日本語の呼び名で出す（CLAUDE.md §5.3）。

import { COUNTRY_SHELVES, countryDisplayName } from './countries';
import { VARIETY_SHELVES, varietyDisplayName, varietyKeysOf } from './varieties';
import { PROCESSES, processDisplayName } from './processes';

export const SUGGEST_LIMIT = 8;

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s\-_・･()（）]+/g, '');
}

interface Entry {
  /** 表示する名前 */
  label: string;
  /** 一致に使う文字列（正規化済み） */
  keys: string[];
}

function suggest(query: string, entries: readonly Entry[], recent: readonly string[]): string[] {
  const q = norm(query);
  const out: string[] = [];
  const push = (label: string) => {
    if (out.length < SUGGEST_LIMIT && !out.includes(label)) out.push(label);
  };
  // 自分が過去に入れた値（表示名に寄せて重複を落とす）を先に
  for (const r of recent) if (q === '' || norm(r).includes(q)) push(r);
  for (const e of entries) if (q === '' || e.keys.some((k) => k.includes(q))) push(e.label);
  // 入力そのものと同じ 1 件だけなら出す意味が無い
  if (out.length === 1 && norm(out[0]!) === q) return [];
  return out;
}

const COUNTRY_ENTRIES: Entry[] = COUNTRY_SHELVES.map((c) => ({
  label: c.ja,
  keys: [c.ja, c.en, ...c.aliases].map(norm),
}));
const PROCESS_ENTRIES: Entry[] = PROCESSES.map((p) => ({
  label: p.name,
  keys: [p.name, p.en, ...p.aliases].map(norm),
}));
const VARIETY_ENTRIES: Entry[] = VARIETY_SHELVES.map((v) => ({
  label: v.name,
  keys: [v.name, v.en ?? '', ...v.aliases].filter(Boolean).map(norm),
}));

/** 過去の値を表示名に寄せて重複を落とす（Ethiopia とエチオピアは 1 つ） */
function dedupeRecent(values: readonly string[], display: (v: string) => string | null): string[] {
  const out: string[] = [];
  for (const v of values) {
    const d = display(v);
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

/** 生産国の候補。`recent` は自分の豆に出てくる生産国（生の値）。 */
export function suggestCountries(query: string, recent: readonly string[] = []): string[] {
  return suggest(query, COUNTRY_ENTRIES, dedupeRecent(recent, countryDisplayName));
}

/** 品種の候補。`recent` は自分の豆に出てくる品種（生の値。「SL28, SL34」のように複数入りも可）。 */
export function suggestVarieties(query: string, recent: readonly string[] = []): string[] {
  // 複数入りの値は品種ごとにばらして候補にする
  const singles: string[] = [];
  for (const r of recent)
    for (const k of varietyKeysOf(r)) {
      const name = k.startsWith('other:') ? k.slice('other:'.length) : (varietyDisplayName(k) ?? k);
      singles.push(name);
    }
  return suggest(
    query,
    VARIETY_ENTRIES,
    dedupeRecent(singles, (v) => v),
  );
}

/** 精製方法の候補。`recent` は自分の豆に出てくる精製方法（生の値）。 */
export function suggestProcesses(query: string, recent: readonly string[] = []): string[] {
  return suggest(query, PROCESS_ENTRIES, dedupeRecent(recent, processDisplayName));
}
