// 店名のあいまい照合（F-SHOP-2/3/4）。検索シートが手元の候補を絞り込むのに使う純粋関数。
// OSM の店名は英字だけ（Fuglen Tokyo）、カタカナだけ（スターバックス）、ひらがな読み付きなどまちまちで、
// 店の看板どおりにカタカナで打っても英字名の店に当たるようにしたい（2026-10-19、CLAUDE.md §1 のライト層）。
// 3 段階で判定する:
//   1. 正規化した文字列の完全一致
//   2. 正規化した文字列の部分一致（全角半角・大文字小文字・ひらがな/カタカナ・空白と記号の違いを無視）
//   3. 子音の骨格が名前のどこかの語の頭から一致（カタカナ ⇄ 英字。フグレン ⇄ Fuglen Tokyo、ブルーボトル ⇄ Blue Bottle）
// 3 は発音の近さを雑に見るだけなので、短すぎる語では使わない（誤爆が増える）。

/** 骨格での照合を使う最短の長さ（子音の数） */
export const SKELETON_MIN_LENGTH = 3;

export const MATCH_SCORE = { exact: 3, substring: 2, skeleton: 1 } as const;

/** ひらがな → カタカナ */
function hiraToKata(s: string): string {
  return s.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

/**
 * 照合用に正規化する: NFKC（全角英数・半角カナをそろえる）→ 小文字 → ひらがなをカタカナに →
 * 空白・中黒・記号を除く。長音「ー」は残す（カタカナの語の一部なので）。
 */
export function normalizeForMatch(s: string): string {
  return hiraToKata(s.normalize('NFKC').toLowerCase()).replace(
    /[\s\u3000・·.,，、。'’"“”&＆!！?？\-‐–—_/／()（）[\]「」『』【】~〜:：;；#＃@＊*+]/g,
    '',
  );
}

// カタカナ 1 文字 → 子音（母音だけの音・ャュョ・ッ・ー は空文字）。英字側の骨格と同じ記号にそろえる:
// f と h は h、l と r は r、j/ジ は z、チ/ツ は t、ヴ は b。
const KANA_CONSONANT: Record<string, string> = {};
function setKana(chars: string, consonant: string) {
  for (const c of chars) KANA_CONSONANT[c] = consonant;
}
setKana('アイウエオァィゥェォヤユヨャュョワヲヮッーヰヱ', '');
setKana('カキクケコヵヶ', 'k');
setKana('ガギグゲゴ', 'g');
setKana('サシスセソ', 's');
setKana('ザジズゼゾヂヅ', 'z');
setKana('タテト', 't');
setKana('チツ', 't');
setKana('ダデド', 'd');
setKana('ナニヌネノン', 'n');
setKana('ハヒフヘホ', 'h');
setKana('バビブベボヴ', 'b');
setKana('パピプペポ', 'p');
setKana('マミムメモ', 'm');
setKana('ラリルレロ', 'r');

/** 英字の語 → 子音の骨格 */
function latinSkeleton(word: string): string {
  const w = word
    .replace(/ph/g, 'f')
    .replace(/sh/g, 's')
    .replace(/ch/g, 't')
    .replace(/th/g, 't')
    .replace(/ts/g, 't')
    .replace(/ck/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/m(?=[bp])/g, 'n');
  let out = '';
  for (let i = 0; i < w.length; i++) {
    const c = w[i]!;
    const next = w[i + 1];
    if ('aeiouyw'.includes(c)) continue;
    // 英語の母音のあとの r は、子音の前では日本語読みで消える（Starbucks → スターバックス）
    if (c === 'r' && next !== undefined && !'aeiouy'.includes(next) && i > 0 && 'aeiou'.includes(w[i - 1]!))
      continue;
    const mapped =
      c === 'f'
        ? 'h'
        : c === 'l'
          ? 'r'
          : c === 'c' || c === 'q'
            ? 'k'
            : c === 'j'
              ? 'z'
              : c === 'v'
                ? 'b'
                : c;
    if (/[a-z]/.test(mapped)) out += mapped;
  }
  return out;
}

/** 語ごとの子音の骨格（英字とカタカナ以外は捨てる）。語の切れ目を見たいので、空白を消す前の文字列を渡す */
function skeletonWords(raw: string): string[] {
  const s = hiraToKata(raw.normalize('NFKC').toLowerCase());
  return (s.match(/[a-z]+|[\u30a0-\u30ff]+/g) ?? []).map((word) =>
    /^[a-z]/.test(word) ? latinSkeleton(word) : [...word].map((c) => KANA_CONSONANT[c] ?? '').join(''),
  );
}

const collapse = (s: string) => s.replace(/(.)\1+/g, '$1');

/** 文字列 → 子音の骨格（同じ子音の連続は 1 つにまとめる） */
export function consonantSkeleton(raw: string): string {
  return collapse(skeletonWords(raw).join(''));
}

/**
 * 名前のどこかの語の頭から、検索語の骨格が始まるか。
 * 語の途中からの一致（グリッチ → Mar"garet"）は誤爆になりやすいので当たりにしない。
 */
function skeletonStartsAtWord(text: string, termSkeleton: string): boolean {
  const words = skeletonWords(text);
  for (let i = 0; i < words.length; i++) {
    if (collapse(words.slice(i).join('')).startsWith(termSkeleton)) return true;
  }
  return false;
}

/** 1 語と 1 つの名前の照合。一致しなければ 0 */
function scoreTerm(term: string, termSkeleton: string, text: string): number {
  const t = normalizeForMatch(text);
  if (!t) return 0;
  if (t === term) return MATCH_SCORE.exact;
  if (t.includes(term)) return MATCH_SCORE.substring;
  if (termSkeleton.length >= SKELETON_MIN_LENGTH && skeletonStartsAtWord(text, termSkeleton))
    return MATCH_SCORE.skeleton;
  return 0;
}

/**
 * 検索語と店の照合スコア（0 は不一致）。検索語を空白で区切り、すべての語がどれかの名前か住所に
 * 当たれば一致（順不同）。スコアは語ごとの最高点の最小値。住所は部分一致まで（骨格では見ない）。
 * 検索語が空なら 1（すべて一致扱い）。
 */
export function matchScore(query: string, names: readonly string[], address?: string | null): number {
  const terms = query
    .split(/[\s\u3000]+/)
    .map((raw) => ({ raw, norm: normalizeForMatch(raw) }))
    .filter((t) => t.norm);
  if (terms.length === 0) return 1;
  const addr = address ? normalizeForMatch(address) : '';
  let total = Infinity;
  for (const { raw, norm: term } of terms) {
    const skeleton = consonantSkeleton(raw);
    let best = 0;
    for (const n of names) best = Math.max(best, scoreTerm(term, skeleton, n));
    if (best === 0 && addr.includes(term)) best = MATCH_SCORE.substring;
    if (best === 0) return 0;
    total = Math.min(total, best);
  }
  return total;
}

type Rankable = { name: string; aliases?: readonly string[]; address: string | null; distanceM?: number };

/** 候補を検索語で絞り、スコアの高い順 → 近い順に並べる */
export function rankCandidates<T extends Rankable>(query: string, candidates: readonly T[]): T[] {
  return candidates
    .map((c) => ({ c, score: matchScore(query, [c.name, ...(c.aliases ?? [])], c.address) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.c.distanceM ?? Infinity) - (b.c.distanceM ?? Infinity))
    .map((x) => x.c);
}

type Mergeable = { name: string; lat: number; lng: number; externalPlaceId: string | null };

/** 2 つの候補リストをまとめる（先のリストを優先）。同じ OSM の ID、または同じ名前で 50m 以内なら重複とみなす */
export function mergeCandidates<T extends Mergeable>(first: readonly T[], second: readonly T[]): T[] {
  const out = [...first];
  for (const c of second) {
    const dup = out.some(
      (o) =>
        (c.externalPlaceId !== null && o.externalPlaceId === c.externalPlaceId) ||
        (normalizeForMatch(o.name) === normalizeForMatch(c.name) &&
          Math.abs(o.lat - c.lat) < 0.0005 &&
          Math.abs(o.lng - c.lng) < 0.0005),
    );
    if (!dup) out.push(c);
  }
  return out;
}
