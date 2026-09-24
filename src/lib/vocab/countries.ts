// 生産国の語彙。表記ゆれ（英語 / カタカナ / 略称 / 産地ブランド名）を 1 つの国に寄せ、日本語の呼び名で見せる。
// コレクションの棚・入力記録一覧の絞り込み・好みの分析が同じ表を使う（CLAUDE.md §5.3「ライト層のユーザー体験を第一にする」）。
// 並び順は棚の順にもなる。

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

const byKey = new Map(COUNTRY_SHELVES.map((c) => [c.key, c]));

/** 棚のキーから定義。`other:` や null は undefined */
export function countryShelfOf(key: string | null | undefined): CountryShelfDef | undefined {
  return key ? byKey.get(key) : undefined;
}

/**
 * 表示名。主要国に当たれば日本語名（Ethiopia → エチオピア）、当たらなければ入力のまま（前後の空白だけ落とす）。
 * 空なら null
 */
export function countryDisplayName(raw: string | null | undefined): string | null {
  const key = countryKeyOf(raw);
  if (key === null) return null;
  return byKey.get(key)?.ja ?? raw!.trim();
}
