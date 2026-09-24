// 豆のコレクション（S10「棚」）の集計。記録の配列から、飲んだ豆を 1 袋ずつにまとめる純粋関数。
// 画面は結果を「棚に並んだ袋」として描くだけ。

export type CollectionSourceLog = {
  id: string;
  logged_on: string;
  rating: number | null;
  place: string;
  bean: {
    id: string;
    name: string;
    country: string | null;
    process?: string | null;
    roaster?: { name: string } | null;
    bean_images?: { side: string; storage_path: string }[] | null;
  };
  shop?: { name: string } | null;
};

export interface CollectionItem {
  beanId: string;
  name: string;
  roasterName: string | null;
  country: string | null;
  process: string | null;
  /** 表面のカード画像（Storage のパス）。無ければ印刷物風のプレースホルダ */
  imagePath: string | null;
  /** 飲んだ回数 */
  count: number;
  /** 星の平均（小数 1 桁）。星付きが無ければ null */
  avgRating: number | null;
  /** 最後に飲んだ日と場所（店名、自宅なら「自宅」、不明なら null） */
  lastLoggedOn: string;
  lastPlace: string | null;
  lastLogId: string;
}

export type CollectionSort = 'country' | 'recent' | 'rating' | 'count';
export const COLLECTION_SORT_CHIPS: { value: CollectionSort; label: string }[] = [
  { value: 'country', label: '生産国の棚' },
  { value: 'recent', label: '最近飲んだ順' },
  { value: 'rating', label: '星が高い順' },
  { value: 'count', label: 'よく飲む順' },
];

/** 記録を豆ごとにまとめる。入力の順序に依存せず、最後に飲んだ日を決める */
export function buildCollection(logs: readonly CollectionSourceLog[]): CollectionItem[] {
  const byBean = new Map<string, { item: CollectionItem; ratings: number[] }>();
  for (const l of logs) {
    const place = l.place === 'home' ? '自宅' : (l.shop?.name ?? null);
    const front = l.bean.bean_images?.find((i) => i.side === 'front')?.storage_path ?? null;
    const hit = byBean.get(l.bean.id);
    if (!hit) {
      byBean.set(l.bean.id, {
        ratings: l.rating === null ? [] : [l.rating],
        item: {
          beanId: l.bean.id,
          name: l.bean.name,
          roasterName: l.bean.roaster?.name ?? null,
          country: l.bean.country,
          process: l.bean.process ?? null,
          imagePath: front,
          count: 1,
          avgRating: null,
          lastLoggedOn: l.logged_on,
          lastPlace: place,
          lastLogId: l.id,
        },
      });
      continue;
    }
    hit.item.count += 1;
    if (l.rating !== null) hit.ratings.push(l.rating);
    if (!hit.item.imagePath && front) hit.item.imagePath = front;
    if (l.logged_on > hit.item.lastLoggedOn) {
      hit.item.lastLoggedOn = l.logged_on;
      hit.item.lastPlace = place;
      hit.item.lastLogId = l.id;
    }
  }
  return Array.from(byBean.values()).map(({ item, ratings }) => ({
    ...item,
    avgRating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null,
  }));
}

export function sortCollection(items: readonly CollectionItem[], sort: CollectionSort): CollectionItem[] {
  const copy = [...items];
  switch (sort) {
    case 'rating':
      copy.sort(
        (a, b) =>
          (b.avgRating ?? -1) - (a.avgRating ?? -1) ||
          b.count - a.count ||
          b.lastLoggedOn.localeCompare(a.lastLoggedOn),
      );
      break;
    case 'count':
      copy.sort((a, b) => b.count - a.count || b.lastLoggedOn.localeCompare(a.lastLoggedOn));
      break;
    default:
      copy.sort((a, b) => b.lastLoggedOn.localeCompare(a.lastLoggedOn) || a.name.localeCompare(b.name, 'ja'));
  }
  return copy;
}

// ---- 生産国の棚（S10「生産国の棚」モード） ----
// 主要な生産国を地域順に固定で並べ、まだ飲んでいない国は空き棚として見せる（コレクションの「埋まっていない枠」）。
// 表記ゆれ（英語・日本語・略称）は aliases で吸収し、どれにも当たらない国名はその名前で棚を作る。

export interface CountryShelfDef {
  key: string;
  ja: string;
  en: string;
  region: string;
  aliases: readonly string[];
}

export const COUNTRY_SHELVES: readonly CountryShelfDef[] = [
  {
    key: 'ethiopia',
    ja: 'エチオピア',
    en: 'Ethiopia',
    region: 'アフリカ',
    aliases: ['ethiopia', 'エチオピア'],
  },
  { key: 'kenya', ja: 'ケニア', en: 'Kenya', region: 'アフリカ', aliases: ['kenya', 'ケニア'] },
  { key: 'rwanda', ja: 'ルワンダ', en: 'Rwanda', region: 'アフリカ', aliases: ['rwanda', 'ルワンダ'] },
  { key: 'burundi', ja: 'ブルンジ', en: 'Burundi', region: 'アフリカ', aliases: ['burundi', 'ブルンジ'] },
  {
    key: 'tanzania',
    ja: 'タンザニア',
    en: 'Tanzania',
    region: 'アフリカ',
    aliases: ['tanzania', 'タンザニア', 'キリマンジャロ', 'kilimanjaro'],
  },
  { key: 'uganda', ja: 'ウガンダ', en: 'Uganda', region: 'アフリカ', aliases: ['uganda', 'ウガンダ'] },
  {
    key: 'yemen',
    ja: 'イエメン',
    en: 'Yemen',
    region: '中東',
    aliases: ['yemen', 'イエメン', 'モカ', 'mocha'],
  },
  {
    key: 'guatemala',
    ja: 'グアテマラ',
    en: 'Guatemala',
    region: '中米',
    aliases: ['guatemala', 'グアテマラ', 'ガテマラ'],
  },
  {
    key: 'costa-rica',
    ja: 'コスタリカ',
    en: 'Costa Rica',
    region: '中米',
    aliases: ['costa rica', 'costarica', 'コスタリカ'],
  },
  { key: 'panama', ja: 'パナマ', en: 'Panama', region: '中米', aliases: ['panama', 'パナマ'] },
  {
    key: 'honduras',
    ja: 'ホンジュラス',
    en: 'Honduras',
    region: '中米',
    aliases: ['honduras', 'ホンジュラス'],
  },
  {
    key: 'el-salvador',
    ja: 'エルサルバドル',
    en: 'El Salvador',
    region: '中米',
    aliases: ['el salvador', 'elsalvador', 'エルサルバドル'],
  },
  {
    key: 'nicaragua',
    ja: 'ニカラグア',
    en: 'Nicaragua',
    region: '中米',
    aliases: ['nicaragua', 'ニカラグア'],
  },
  { key: 'mexico', ja: 'メキシコ', en: 'Mexico', region: '中米', aliases: ['mexico', 'méxico', 'メキシコ'] },
  {
    key: 'colombia',
    ja: 'コロンビア',
    en: 'Colombia',
    region: '南米',
    aliases: ['colombia', 'columbia', 'コロンビア'],
  },
  { key: 'brazil', ja: 'ブラジル', en: 'Brazil', region: '南米', aliases: ['brazil', 'brasil', 'ブラジル'] },
  { key: 'peru', ja: 'ペルー', en: 'Peru', region: '南米', aliases: ['peru', 'perú', 'ペルー'] },
  { key: 'bolivia', ja: 'ボリビア', en: 'Bolivia', region: '南米', aliases: ['bolivia', 'ボリビア'] },
  { key: 'ecuador', ja: 'エクアドル', en: 'Ecuador', region: '南米', aliases: ['ecuador', 'エクアドル'] },
  {
    key: 'indonesia',
    ja: 'インドネシア',
    en: 'Indonesia',
    region: 'アジア',
    aliases: [
      'indonesia',
      'インドネシア',
      'sumatra',
      'スマトラ',
      'マンデリン',
      'mandheling',
      'java',
      'ジャワ',
      'sulawesi',
      'スラウェシ',
      'bali',
      'バリ',
    ],
  },
  {
    key: 'png',
    ja: 'パプアニューギニア',
    en: 'Papua New Guinea',
    region: 'アジア',
    aliases: ['papua new guinea', 'png', 'パプアニューギニア'],
  },
  { key: 'india', ja: 'インド', en: 'India', region: 'アジア', aliases: ['india', 'インド'] },
  {
    key: 'vietnam',
    ja: 'ベトナム',
    en: 'Vietnam',
    region: 'アジア',
    aliases: ['vietnam', 'viet nam', 'ベトナム'],
  },
  { key: 'china', ja: '中国', en: 'China', region: 'アジア', aliases: ['china', '中国', 'yunnan', '雲南'] },
  { key: 'thailand', ja: 'タイ', en: 'Thailand', region: 'アジア', aliases: ['thailand', 'タイ'] },
  { key: 'laos', ja: 'ラオス', en: 'Laos', region: 'アジア', aliases: ['laos', 'ラオス'] },
  {
    key: 'hawaii',
    ja: 'ハワイ',
    en: 'Hawaii',
    region: '太平洋',
    aliases: ['hawaii', 'ハワイ', 'kona', 'コナ'],
  },
];

const aliasIndex = new Map<string, string>();
for (const c of COUNTRY_SHELVES) for (const a of c.aliases) aliasIndex.set(a, c.key);

function normalizeCountry(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_\-・･]+/g, ' ')
    .replace(/共和国$/, '');
}

/** 生産国の文字列を棚のキーに。主要国に当たらなければ `other:<正規化した名前>`、空なら null */
export function countryKeyOf(country: string | null | undefined): string | null {
  if (!country || country.trim() === '') return null;
  const n = normalizeCountry(country);
  const direct = aliasIndex.get(n) ?? aliasIndex.get(n.replace(/ /g, ''));
  if (direct) return direct;
  // 「Ethiopia Yirgacheffe」のように国名で始まる表記
  for (const [alias, key] of aliasIndex) if (n.startsWith(alias + ' ')) return key;
  return `other:${n}`;
}

export interface CountryShelf {
  key: string;
  ja: string;
  en: string | null;
  region: string | null;
  items: CollectionItem[];
}

export interface CountryShelves {
  shelves: CountryShelf[];
  /** 主要な生産国のうち、飲んだことのある数 */
  visited: number;
  total: number;
}

/** 生産国ごとの棚。主要国は地域順に固定で（空でも）並べ、そのあとにその他の国と「生産国なし」を続ける */
export function groupByCountry(items: readonly CollectionItem[]): CountryShelves {
  const buckets = new Map<string, CollectionItem[]>();
  const unknown: CollectionItem[] = [];
  for (const it of items) {
    const k = countryKeyOf(it.country);
    if (k === null) {
      unknown.push(it);
      continue;
    }
    const arr = buckets.get(k) ?? [];
    arr.push(it);
    buckets.set(k, arr);
  }
  const shelves: CountryShelf[] = COUNTRY_SHELVES.map((c) => ({
    key: c.key,
    ja: c.ja,
    en: c.en,
    region: c.region,
    items: buckets.get(c.key) ?? [],
  }));
  const visited = shelves.filter((s) => s.items.length > 0).length;
  const others = Array.from(buckets.entries())
    .filter(([k]) => k.startsWith('other:'))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, arr]) => ({ key: k, ja: arr[0]!.country ?? k.slice(6), en: null, region: null, items: arr }));
  const out = [...shelves, ...others];
  if (unknown.length > 0)
    out.push({ key: 'unknown', ja: '生産国なし', en: null, region: null, items: unknown });
  return { shelves: out, visited, total: COUNTRY_SHELVES.length };
}
