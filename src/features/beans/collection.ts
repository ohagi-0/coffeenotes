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
    variety?: string | null;
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
  variety: string | null;
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

export type CollectionSort = 'country' | 'variety' | 'recent' | 'rating' | 'count';
export const COLLECTION_SORT_CHIPS: { value: CollectionSort; label: string }[] = [
  { value: 'country', label: '生産国の棚' },
  { value: 'variety', label: '品種の棚' },
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
          variety: l.bean.variety ?? null,
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

/** 1 本の棚（生産国・品種で共通） */
export interface ShelfGroup {
  key: string;
  /** 見出し（日本語名。主要でない値はそのままの表記） */
  title: string;
  /** 見出しの右に添える英名など */
  sub: string | null;
  /** 空き棚のときに右端に出す補足（地域・系統） */
  note: string | null;
  items: CollectionItem[];
}

export interface ShelfGroups {
  shelves: ShelfGroup[];
  /** 主要な棚のうち、飲んだことのある数 */
  visited: number;
  total: number;
}

/** 生産国ごとの棚。主要国は地域順に固定で（空でも）並べ、そのあとにその他の国と「生産国なし」を続ける */
export function groupByCountry(items: readonly CollectionItem[]): ShelfGroups {
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
  const shelves: ShelfGroup[] = COUNTRY_SHELVES.map((c) => ({
    key: c.key,
    title: c.ja,
    sub: c.en,
    note: c.region,
    items: buckets.get(c.key) ?? [],
  }));
  const visited = shelves.filter((s) => s.items.length > 0).length;
  const others = Array.from(buckets.entries())
    .filter(([k]) => k.startsWith('other:'))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, arr]) => ({ key: k, title: arr[0]!.country ?? k.slice(6), sub: null, note: null, items: arr }));
  const out = [...shelves, ...others];
  if (unknown.length > 0)
    out.push({ key: 'unknown', title: '生産国なし', sub: null, note: null, items: unknown });
  return { shelves: out, visited, total: COUNTRY_SHELVES.length };
}

// ---- 品種の棚（S10「品種の棚」モード） ----
// よくある品種を系統ごとに固定で並べる。1 つの豆に「SL28, SL34」のように複数あれば両方の棚に置く。

export interface VarietyShelfDef {
  key: string;
  name: string;
  /** 英語表記（見出しの右に添える）。name と同じなら null */
  en: string | null;
  group: string;
  aliases: readonly string[];
}

export const VARIETY_SHELVES: readonly VarietyShelfDef[] = [
  {
    key: 'geisha',
    name: 'ゲイシャ',
    en: 'Geisha',
    group: 'エチオピア由来',
    aliases: ['geisha', 'gesha', 'ゲイシャ', 'ゲシャ'],
  },
  {
    key: 'heirloom',
    name: 'エチオピア在来種',
    en: 'Heirloom',
    group: 'エチオピア由来',
    aliases: [
      'heirloom',
      'ethiopian heirloom',
      'ethiopia heirloom',
      'landrace',
      'ethiopian landrace',
      '在来種',
      'エアルーム',
      'ヘアルーム',
      '74158',
      '74110',
      '74112',
      '74165',
      '74140',
      'jarc',
    ],
  },
  {
    key: 'wush-wush',
    name: 'ウシュウシュ',
    en: 'Wush Wush',
    group: 'エチオピア由来',
    aliases: ['wush wush', 'wushwush', 'ウシュウシュ', 'ウシュ ウシュ'],
  },
  { key: 'sl28', name: 'SL28', en: null, group: 'ケニア系', aliases: ['sl28', 'sl 28', 'sl-28'] },
  { key: 'sl34', name: 'SL34', en: null, group: 'ケニア系', aliases: ['sl34', 'sl 34', 'sl-34'] },
  {
    key: 'ruiru11',
    name: 'Ruiru 11',
    en: null,
    group: 'ケニア系',
    aliases: ['ruiru 11', 'ruiru11', 'ルイル11', 'ルイル 11'],
  },
  { key: 'batian', name: 'Batian', en: null, group: 'ケニア系', aliases: ['batian', 'バティアン'] },
  {
    key: 'typica',
    name: 'ティピカ',
    en: 'Typica',
    group: 'ティピカ系',
    aliases: ['typica', 'ティピカ', 'tipica'],
  },
  { key: 'java', name: 'ジャバ', en: 'Java', group: 'ティピカ系', aliases: ['java', 'ジャバ', 'ジャワ種'] },
  {
    key: 'maragogipe',
    name: 'マラゴジッペ',
    en: 'Maragogipe',
    group: 'ティピカ系',
    aliases: ['maragogipe', 'maragogype', 'マラゴジッペ', 'マラゴジペ'],
  },
  { key: 'kent', name: 'ケント', en: 'Kent', group: 'ティピカ系', aliases: ['kent', 'ケント'] },
  {
    key: 'bourbon',
    name: 'ブルボン',
    en: 'Bourbon',
    group: 'ブルボン系',
    aliases: [
      'bourbon',
      'ブルボン',
      'red bourbon',
      'yellow bourbon',
      'orange bourbon',
      'イエローブルボン',
      'レッドブルボン',
    ],
  },
  {
    key: 'pink-bourbon',
    name: 'ピンクブルボン',
    en: 'Pink Bourbon',
    group: 'ブルボン系',
    aliases: ['pink bourbon', 'ピンクブルボン'],
  },
  {
    key: 'caturra',
    name: 'カトゥーラ',
    en: 'Caturra',
    group: 'ブルボン系',
    aliases: ['caturra', 'カトゥーラ', 'カツーラ'],
  },
  {
    key: 'catuai',
    name: 'カトゥアイ',
    en: 'Catuai',
    group: 'ブルボン系',
    aliases: ['catuai', 'catuaí', 'カトゥアイ', 'yellow catuai', 'red catuai'],
  },
  {
    key: 'mundo-novo',
    name: 'ムンドノーボ',
    en: 'Mundo Novo',
    group: 'ブルボン系',
    aliases: ['mundo novo', 'ムンドノーボ', 'ムンドノボ'],
  },
  { key: 'pacas', name: 'パカス', en: 'Pacas', group: 'ブルボン系', aliases: ['pacas', 'パカス'] },
  {
    key: 'villa-sarchi',
    name: 'ビジャサルチ',
    en: 'Villa Sarchi',
    group: 'ブルボン系',
    aliases: ['villa sarchi', 'villasarchi', 'ビジャサルチ', 'ヴィラサルチ'],
  },
  { key: 'pacamara', name: 'パカマラ', en: 'Pacamara', group: '大粒種', aliases: ['pacamara', 'パカマラ'] },
  {
    key: 'maracaturra',
    name: 'マラカトゥーラ',
    en: 'Maracaturra',
    group: '大粒種',
    aliases: ['maracaturra', 'マラカトゥーラ'],
  },
  { key: 'sidra', name: 'シドラ', en: 'Sidra', group: '新しい品種', aliases: ['sidra', 'シドラ'] },
  {
    key: 'sudan-rume',
    name: 'スーダンルメ',
    en: 'Sudan Rume',
    group: '新しい品種',
    aliases: ['sudan rume', 'スーダンルメ'],
  },
  {
    key: 'castillo',
    name: 'カスティージョ',
    en: 'Castillo',
    group: 'ハイブリッド',
    aliases: ['castillo', 'カスティージョ', 'カスティーヨ'],
  },
  {
    key: 'catimor',
    name: 'カティモール',
    en: 'Catimor',
    group: 'ハイブリッド',
    aliases: ['catimor', 'カティモール', 'カチモール'],
  },
  {
    key: 'sarchimor',
    name: 'サルチモール',
    en: 'Sarchimor',
    group: 'ハイブリッド',
    aliases: [
      'sarchimor',
      'サルチモール',
      'parainema',
      'パライネマ',
      'ih90',
      'ih-90',
      'lempira',
      'レンピラ',
      'obata',
      'オバタ',
    ],
  },
  {
    key: 'timor-hybrid',
    name: 'ティモールハイブリッド',
    en: 'Timor Hybrid',
    group: 'ハイブリッド',
    aliases: ['timor hybrid', 'hibrido de timor', 'ティモールハイブリッド'],
  },
  {
    key: 'anacafe14',
    name: 'Anacafe 14',
    en: null,
    group: 'ハイブリッド',
    aliases: ['anacafe 14', 'anacafe14'],
  },
  {
    key: 'f1',
    name: 'F1 ハイブリッド',
    en: 'F1 Hybrid',
    group: 'ハイブリッド',
    aliases: ['f1', 'f1 hybrid', 'centroamericano', 'starmaya', 'h1', 'マルセレサ', 'marsellesa'],
  },
];

const varietyAliasIndex = new Map<string, string>();
for (const v of VARIETY_SHELVES)
  for (const a of v.aliases) varietyAliasIndex.set(a.replace(/[\s\-]+/g, ''), v.key);

function normalizeVarietyToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-_・･()（）]+/g, '');
}

/**
 * 品種の文字列を棚のキーの配列に。「SL28, SL34」「Bourbon / Typica」のように区切られていれば全部。
 * 主要品種に当たらないものは `other:<正規化した名前>`。空なら []
 */
export function varietyKeysOf(variety: string | null | undefined): string[] {
  if (!variety || variety.trim() === '') return [];
  const tokens = variety
    .split(/[,、，/／&＆+＋]|\s+(?:and|と)\s+|\s*・\s*/i)
    .map((t) => t.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    const n = normalizeVarietyToken(t);
    let key = varietyAliasIndex.get(n);
    if (!key) {
      // 「Red Bourbon」「Geisha (Panama)」のように前後に語が付く表記
      for (const [alias, k] of varietyAliasIndex) {
        // 短い英字の別名（f1 など）は誤爆するので部分一致の対象にしない。日本語は 3 文字から
        const longEnough = alias.length >= 4 || (alias.length >= 3 && /[^\x00-\x7f]/.test(alias));
        if (longEnough && n.includes(alias)) {
          key = k;
          break;
        }
      }
    }
    const k = key ?? `other:${t.trim().toLowerCase()}`;
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

/** 品種ごとの棚。主要品種は系統順に固定で（空でも）並べ、そのあとにその他と「品種なし」を続ける */
export function groupByVariety(items: readonly CollectionItem[]): ShelfGroups {
  const buckets = new Map<string, CollectionItem[]>();
  const unknown: CollectionItem[] = [];
  for (const it of items) {
    const keys = varietyKeysOf(it.variety);
    if (keys.length === 0) {
      unknown.push(it);
      continue;
    }
    for (const k of keys) {
      const arr = buckets.get(k) ?? [];
      arr.push(it);
      buckets.set(k, arr);
    }
  }
  const shelves: ShelfGroup[] = VARIETY_SHELVES.map((v) => ({
    key: v.key,
    title: v.name,
    sub: v.en,
    note: v.group,
    items: buckets.get(v.key) ?? [],
  }));
  const visited = shelves.filter((s) => s.items.length > 0).length;
  const others = Array.from(buckets.entries())
    .filter(([k]) => k.startsWith('other:'))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, arr]) => ({ key: k, title: k.slice(6), sub: null, note: null, items: arr }));
  const out = [...shelves, ...others];
  if (unknown.length > 0)
    out.push({ key: 'unknown', title: '品種なし', sub: null, note: null, items: unknown });
  return { shelves: out, visited, total: VARIETY_SHELVES.length };
}
