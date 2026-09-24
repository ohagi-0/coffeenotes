// 品種の語彙。店のカードに書かれる品種名の表記ゆれ（英語 / カタカナ / 略記 / 系統名）を 1 つの棚に寄せ、日本語の呼び名で見せる。
// コレクションの棚と入力欄の候補が同じ表を使う（CLAUDE.md §5.3「ライト層のユーザー体験を第一にする」）。
// 並び順は棚の順にもなる。

export interface VarietyShelfDef {
  key: string;
  /** 見出し（日本語の呼び名。店のカードに書かれる言葉に合わせる） */
  name: string;
  /** 英語表記（見出しの右に添える）。name と同じなら null */
  en: string | null;
  aliases: readonly string[];
}

// 並び順 = 日本のスペシャルティコーヒー店のカードで見かける頻度（主観。docs/decisions/0009）。
// 植物学の系統ではなく「店で見た言葉」を棚にする（ブルーマウンテンは独立、系統名は出さない）。
export const VARIETY_SHELVES: readonly VarietyShelfDef[] = [
  { key: 'geisha', name: 'ゲイシャ', en: 'Geisha', aliases: ['geisha', 'gesha', 'ゲイシャ', 'ゲシャ'] },
  {
    key: 'heirloom',
    name: 'エチオピア在来種',
    en: 'Heirloom',
    aliases: [
      'heirloom',
      'ethiopian heirloom',
      'ethiopia heirloom',
      'landrace',
      'ethiopian landrace',
      'local landrace',
      '在来種',
      'エアルーム',
      'ヘアルーム',
      'ランドレース',
      '74158',
      '74110',
      '74112',
      '74165',
      '74140',
      'jarc',
    ],
  },
  {
    key: 'bourbon',
    name: 'ブルボン',
    en: 'Bourbon',
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
  { key: 'typica', name: 'ティピカ', en: 'Typica', aliases: ['typica', 'ティピカ', 'tipica'] },
  { key: 'caturra', name: 'カトゥーラ', en: 'Caturra', aliases: ['caturra', 'カトゥーラ', 'カツーラ'] },
  {
    key: 'catuai',
    name: 'カトゥアイ',
    en: 'Catuai',
    aliases: ['catuai', 'catuaí', 'カトゥアイ', 'yellow catuai', 'red catuai'],
  },
  { key: 'sl28', name: 'SL28', en: null, aliases: ['sl28', 'sl 28', 'sl-28'] },
  { key: 'sl34', name: 'SL34', en: null, aliases: ['sl34', 'sl 34', 'sl-34'] },
  { key: 'pacamara', name: 'パカマラ', en: 'Pacamara', aliases: ['pacamara', 'パカマラ'] },
  {
    key: 'pink-bourbon',
    name: 'ピンクブルボン',
    en: 'Pink Bourbon',
    aliases: ['pink bourbon', 'ピンクブルボン'],
  },
  {
    key: 'castillo',
    name: 'カスティージョ',
    en: 'Castillo',
    aliases: ['castillo', 'カスティージョ', 'カスティーヨ'],
  },
  {
    key: 'blue-mountain',
    name: 'ブルーマウンテン',
    en: 'Blue Mountain',
    aliases: ['blue mountain', 'bluemountain', 'ブルーマウンテン', 'ブルマン'],
  },
  {
    key: 'mundo-novo',
    name: 'ムンドノーボ',
    en: 'Mundo Novo',
    aliases: ['mundo novo', 'ムンドノーボ', 'ムンドノボ'],
  },
  { key: 'pacas', name: 'パカス', en: 'Pacas', aliases: ['pacas', 'パカス'] },
  { key: 'sidra', name: 'シドラ', en: 'Sidra', aliases: ['sidra', 'シドラ'] },
  { key: 'catimor', name: 'カティモール', en: 'Catimor', aliases: ['catimor', 'カティモール', 'カチモール'] },
  {
    key: 'maragogipe',
    name: 'マラゴジッペ',
    en: 'Maragogipe',
    aliases: ['maragogipe', 'maragogype', 'マラゴジッペ', 'マラゴジペ'],
  },
  { key: 'tabi', name: 'タビ', en: 'Tabi', aliases: ['tabi', 'タビ'] },
  { key: 'chiroso', name: 'チロソ', en: 'Chiroso', aliases: ['chiroso', 'チロソ'] },
  { key: 'java', name: 'ジャバ', en: 'Java', aliases: ['java', 'ジャバ', 'ジャワ種'] },
  {
    key: 'wush-wush',
    name: 'ウシュウシュ',
    en: 'Wush Wush',
    aliases: ['wush wush', 'wushwush', 'ウシュウシュ', 'ウシュ ウシュ'],
  },
  {
    key: 'ruiru11',
    name: 'ルイル 11',
    en: 'Ruiru 11',
    aliases: ['ruiru 11', 'ruiru11', 'ルイル11', 'ルイル 11'],
  },
  { key: 'batian', name: 'バティアン', en: 'Batian', aliases: ['batian', 'バティアン'] },
  { key: 'laurina', name: 'ラウリナ', en: 'Laurina', aliases: ['laurina', 'ラウリナ', 'bourbon pointu'] },
  { key: 'parainema', name: 'パライネマ', en: 'Parainema', aliases: ['parainema', 'パライネマ'] },
];

const varietyAliasIndex = new Map<string, string>();
for (const v of VARIETY_SHELVES)
  for (const a of v.aliases) varietyAliasIndex.set(a.replace(/[\s\-]+/g, ''), v.key);

/** 種の名前（アラビカ / ロブスタ など）。品種ではないので棚にせず、それだけなら「品種なし」と同じ扱い */
const SPECIES_TOKENS = new Set(
  [
    'arabica',
    'アラビカ',
    'アラビカ種',
    'robusta',
    'ロブスタ',
    'ロブスタ種',
    'canephora',
    'カネフォラ',
    'liberica',
    'リベリカ',
  ].map((t) => t.replace(/[\s\-]+/g, '')),
);

function normalizeVarietyToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-_・･()（）]+/g, '');
}

/**
 * 品種の文字列を棚のキーの配列に。「SL28, SL34」「Bourbon / Typica」のように区切られていれば全部。
 * 主要品種に当たらないものは `other:<正規化した名前>`。種の名前（アラビカ / ロブスタ）は捨てる。空なら []
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
    if (SPECIES_TOKENS.has(n)) continue;
    let key = varietyAliasIndex.get(n);
    if (!key) {
      // 「Red Bourbon」「Blue Mountain (Typica)」のように前後に語が付く表記は、含まれる別名のうち一番長いものを採る
      let best = '';
      for (const [alias, k] of varietyAliasIndex) {
        // 短い英字の別名は誤爆するので部分一致の対象にしない。日本語は 3 文字から
        const longEnough = alias.length >= 4 || (alias.length >= 3 && /[^\x00-\x7f]/.test(alias));
        if (longEnough && alias.length > best.length && n.includes(alias)) {
          best = alias;
          key = k;
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
