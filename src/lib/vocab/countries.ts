// 生産国の語彙。表記ゆれ（英語 / カタカナ / 略称 / 産地ブランド名）を 1 つの国に寄せ、日本語の呼び名で見せる。
// コレクションの棚・入力記録一覧の絞り込み・好みの分析が同じ表を使う（CLAUDE.md §5.3「ライト層のユーザー体験を第一にする」）。
// 並び順は棚の順にもなる。

export interface CountryShelfDef {
  key: string;
  ja: string;
  en: string;
  region: string;
  /** ISO 3166-1 の数値コード（産地の地図の塗りに使う。ハワイは米国の一部なので無し） */
  iso?: number;
  aliases: readonly string[];
}

// 並び順 = 生産量順（FAO 2023 の生豆生産量。docs/decisions/0009）。よく見る国が上に来る。
// FAO の表に無い（年 1 万トン未満の）ブルンジ・エクアドル・ジャマイカ・ハワイは末尾に生産量の目安の順。
export const COUNTRY_SHELVES: readonly CountryShelfDef[] = [
  {
    key: 'brazil',
    iso: 76,
    ja: 'ブラジル',
    en: 'Brazil',
    region: '南米',
    aliases: ['brazil', 'brasil', 'ブラジル'],
  },
  {
    key: 'vietnam',
    iso: 704,
    ja: 'ベトナム',
    en: 'Vietnam',
    region: 'アジア',
    aliases: ['vietnam', 'viet nam', 'ベトナム'],
  },
  {
    key: 'indonesia',
    iso: 360,
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
    key: 'colombia',
    iso: 170,
    ja: 'コロンビア',
    en: 'Colombia',
    region: '南米',
    aliases: ['colombia', 'columbia', 'コロンビア'],
  },
  {
    key: 'ethiopia',
    iso: 231,
    ja: 'エチオピア',
    en: 'Ethiopia',
    region: 'アフリカ',
    aliases: ['ethiopia', 'エチオピア'],
  },
  {
    key: 'honduras',
    iso: 340,
    ja: 'ホンジュラス',
    en: 'Honduras',
    region: '中米',
    aliases: ['honduras', 'ホンジュラス'],
  },
  {
    key: 'uganda',
    iso: 800,
    ja: 'ウガンダ',
    en: 'Uganda',
    region: 'アフリカ',
    aliases: ['uganda', 'ウガンダ'],
  },
  { key: 'peru', iso: 604, ja: 'ペルー', en: 'Peru', region: '南米', aliases: ['peru', 'perú', 'ペルー'] },
  { key: 'india', iso: 356, ja: 'インド', en: 'India', region: 'アジア', aliases: ['india', 'インド'] },
  {
    key: 'guatemala',
    iso: 320,
    ja: 'グアテマラ',
    en: 'Guatemala',
    region: '中米',
    aliases: ['guatemala', 'グアテマラ', 'ガテマラ'],
  },
  {
    key: 'mexico',
    iso: 484,
    ja: 'メキシコ',
    en: 'Mexico',
    region: '中米',
    aliases: ['mexico', 'méxico', 'メキシコ'],
  },
  { key: 'laos', iso: 418, ja: 'ラオス', en: 'Laos', region: 'アジア', aliases: ['laos', 'ラオス'] },
  {
    key: 'nicaragua',
    iso: 558,
    ja: 'ニカラグア',
    en: 'Nicaragua',
    region: '中米',
    aliases: ['nicaragua', 'ニカラグア'],
  },
  {
    key: 'china',
    iso: 156,
    ja: '中国',
    en: 'China',
    region: 'アジア',
    aliases: ['china', '中国', 'yunnan', '雲南'],
  },
  {
    key: 'costa-rica',
    iso: 188,
    ja: 'コスタリカ',
    en: 'Costa Rica',
    region: '中米',
    aliases: ['costa rica', 'costarica', 'コスタリカ'],
  },
  {
    key: 'tanzania',
    iso: 834,
    ja: 'タンザニア',
    en: 'Tanzania',
    region: 'アフリカ',
    aliases: ['tanzania', 'タンザニア', 'キリマンジャロ', 'kilimanjaro'],
  },
  { key: 'kenya', iso: 404, ja: 'ケニア', en: 'Kenya', region: 'アフリカ', aliases: ['kenya', 'ケニア'] },
  {
    key: 'png',
    iso: 598,
    ja: 'パプアニューギニア',
    en: 'Papua New Guinea',
    region: 'アジア',
    aliases: ['papua new guinea', 'png', 'パプアニューギニア'],
  },
  {
    key: 'el-salvador',
    iso: 222,
    ja: 'エルサルバドル',
    en: 'El Salvador',
    region: '中米',
    aliases: ['el salvador', 'elsalvador', 'エルサルバドル'],
  },
  {
    key: 'yemen',
    iso: 887,
    ja: 'イエメン',
    en: 'Yemen',
    region: '中東',
    aliases: ['yemen', 'イエメン', 'モカ', 'mocha'],
  },
  {
    key: 'rwanda',
    iso: 646,
    ja: 'ルワンダ',
    en: 'Rwanda',
    region: 'アフリカ',
    aliases: ['rwanda', 'ルワンダ'],
  },
  {
    key: 'bolivia',
    iso: 68,
    ja: 'ボリビア',
    en: 'Bolivia',
    region: '南米',
    aliases: ['bolivia', 'ボリビア'],
  },
  { key: 'thailand', iso: 764, ja: 'タイ', en: 'Thailand', region: 'アジア', aliases: ['thailand', 'タイ'] },
  { key: 'panama', iso: 591, ja: 'パナマ', en: 'Panama', region: '中米', aliases: ['panama', 'パナマ'] },
  {
    key: 'burundi',
    iso: 108,
    ja: 'ブルンジ',
    en: 'Burundi',
    region: 'アフリカ',
    aliases: ['burundi', 'ブルンジ'],
  },
  {
    key: 'ecuador',
    iso: 218,
    ja: 'エクアドル',
    en: 'Ecuador',
    region: '南米',
    aliases: ['ecuador', 'エクアドル'],
  },
  {
    key: 'jamaica',
    iso: 388,
    ja: 'ジャマイカ',
    en: 'Jamaica',
    region: 'カリブ',
    aliases: ['jamaica', 'ジャマイカ', 'ブルーマウンテン', 'blue mountain', 'bluemountain'],
  },
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

/** 英名（Colombia など）。別名表に無い国は null（呼び出し側で打ったままを使う）。豆の袋のラベル用（S10） */
export function countryEnglishName(raw: string | null | undefined): string | null {
  const key = countryKeyOf(raw);
  if (key === null) return null;
  return byKey.get(key)?.en ?? null;
}
