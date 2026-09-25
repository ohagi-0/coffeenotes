// 精製方法の語彙。店のカードの表記ゆれ（Washed / ウォッシュド / 水洗式、Honey / パルプドナチュラル など）を
// 1 つの呼び名に寄せ、絞り込みと分析で同じ日本語名にする（CLAUDE.md §5.3）。
// 値は入力どおり保存し（Red Honey、Anaerobic Natural のような差は残す）、寄せるのは表示と絞り込みだけ。

export interface ProcessDef {
  key: string;
  /** 見出し（日本語の呼び名） */
  name: string;
  en: string;
  aliases: readonly string[];
}

// 並び順 = 店で見かける頻度（主観）。入力候補の順にもなる
export const PROCESSES: readonly ProcessDef[] = [
  {
    key: 'washed',
    name: 'ウォッシュド',
    en: 'Washed',
    aliases: [
      'washed',
      'fully washed',
      'wet process',
      'water process',
      'ウォッシュド',
      'ウォッシュト',
      'ウォッシュ',
      '水洗',
      '水洗式',
    ],
  },
  {
    key: 'natural',
    name: 'ナチュラル',
    en: 'Natural',
    aliases: [
      'natural',
      'dry process',
      'sun dried',
      'sun-dried',
      'ナチュラル',
      '非水洗',
      '非水洗式',
      '乾燥式',
      '天日乾燥',
    ],
  },
  {
    key: 'honey',
    name: 'ハニー',
    en: 'Honey',
    aliases: [
      'honey',
      'pulped natural',
      'red honey',
      'yellow honey',
      'black honey',
      'white honey',
      'ハニー',
      'ハニープロセス',
      'パルプドナチュラル',
    ],
  },
  {
    key: 'anaerobic',
    name: 'アナエロビック',
    en: 'Anaerobic',
    aliases: [
      'anaerobic',
      'anaerobic natural',
      'anaerobic washed',
      'anaerobic honey',
      'アナエロビック',
      'アナエロ',
      '嫌気性発酵',
      '嫌気発酵',
    ],
  },
  {
    key: 'carbonic',
    name: 'カーボニックマセレーション',
    en: 'Carbonic Maceration',
    aliases: ['carbonic maceration', 'carbonic', 'カーボニックマセレーション', 'カーボニック'],
  },
  {
    key: 'infused',
    name: 'インフューズド',
    en: 'Infused',
    aliases: [
      'infused',
      'infusion',
      'co-fermented',
      'co-ferment',
      'cofermented',
      'インフューズド',
      'コファーメント',
    ],
  },
  {
    key: 'wet-hulled',
    name: 'ウェットハル',
    en: 'Wet Hulled',
    aliases: ['wet hulled', 'wet-hulled', 'giling basah', 'ウェットハル', 'ギリンバサ', 'スマトラ式'],
  },
];

const aliasIndex = new Map<string, string>();
for (const p of PROCESSES) for (const a of p.aliases) aliasIndex.set(a.replace(/[\s\-]+/g, ''), p.key);
const byKey = new Map(PROCESSES.map((p) => [p.key, p]));

function normalize(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-_・･()（）/／]+/g, '');
}

/** 精製方法の文字列を語彙のキーに。当たらなければ `other:<正規化した名前>`、空なら null */
export function processKeyOf(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === '') return null;
  const n = normalize(raw);
  const direct = aliasIndex.get(n);
  if (direct) return direct;
  // 「Lime infused」「Anaerobic Natural」のように語が付く表記は、含まれる別名のうち一番長いものを採る
  let best = '';
  let key: string | null = null;
  for (const [alias, k] of aliasIndex) {
    const longEnough = alias.length >= 4 || (alias.length >= 3 && /[^\x00-\x7f]/.test(alias));
    if (longEnough && alias.length > best.length && n.includes(alias)) {
      best = alias;
      key = k;
    }
  }
  return key ?? `other:${raw.trim().toLowerCase()}`;
}

/** 表示名。語彙に当たれば日本語名（Washed → ウォッシュド）、当たらなければ入力のまま。空なら null */
export function processDisplayName(raw: string | null | undefined): string | null {
  const key = processKeyOf(raw);
  if (key === null) return null;
  return byKey.get(key)?.name ?? raw!.trim();
}
