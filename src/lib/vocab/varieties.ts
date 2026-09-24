// 品種の語彙。店のカードに書かれる品種名の表記ゆれ（英語 / カタカナ / 略記 / 系統名）を 1 つの棚に寄せ、日本語の呼び名で見せる。
// コレクションの棚と入力欄の候補が同じ表を使う（CLAUDE.md §5.3「ライト層のユーザー体験を第一にする」）。
// 並び順は棚の順にもなる。

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

const byKey = new Map(VARIETY_SHELVES.map((v) => [v.key, v]));

/** 棚のキーから定義。`other:` は undefined */
export function varietyShelfOf(key: string | null | undefined): VarietyShelfDef | undefined {
  return key ? byKey.get(key) : undefined;
}

/**
 * 表示名。区切りごとに主要品種なら日本語名（Geisha → ゲイシャ）、当たらなければ入力のまま。「, 」で結合。空なら null
 */
export function varietyDisplayName(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === '') return null;
  const keys = varietyKeysOf(raw);
  if (keys.length === 0) return null;
  return keys.map((k) => byKey.get(k)?.name ?? k.slice('other:'.length)).join(', ');
}
