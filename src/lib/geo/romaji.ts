// かな → ローマ字（ヘボン式の簡易版）。店名検索で、カタカナの検索語を英字名の店にも当てるために使う（ADR 0010）。
// 例: フグレン → fuguren（Photon のあいまい検索で Fuglen に当たる）。長音「ー」は落とす（ブルー → buru）。
// 完全な変換ではない。英字名の店に当たる見込みを少し上げるための補助。

// prettier-ignore
const BASE: Record<string, string> = {
  ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o',
  カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
  ガ: 'ga', ギ: 'gi', グ: 'gu', ゲ: 'ge', ゴ: 'go',
  サ: 'sa', シ: 'shi', ス: 'su', セ: 'se', ソ: 'so',
  ザ: 'za', ジ: 'ji', ズ: 'zu', ゼ: 'ze', ゾ: 'zo',
  タ: 'ta', チ: 'chi', ツ: 'tsu', テ: 'te', ト: 'to',
  ダ: 'da', ヂ: 'ji', ヅ: 'zu', デ: 'de', ド: 'do',
  ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no',
  ハ: 'ha', ヒ: 'hi', フ: 'fu', ヘ: 'he', ホ: 'ho',
  バ: 'ba', ビ: 'bi', ブ: 'bu', ベ: 'be', ボ: 'bo',
  パ: 'pa', ピ: 'pi', プ: 'pu', ペ: 'pe', ポ: 'po',
  マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo',
  ヤ: 'ya', ユ: 'yu', ヨ: 'yo',
  ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro',
  ワ: 'wa', ヲ: 'o', ン: 'n', ヴ: 'vu',
  ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o',
};

/** 小さいャュョ・ァィゥェォで前の音を変える組み合わせ（キャ → kya、ティ → ti、ファ → fa など） */
// prettier-ignore
const COMBO: Record<string, string> = {
  キャ: 'kya', キュ: 'kyu', キョ: 'kyo', ギャ: 'gya', ギュ: 'gyu', ギョ: 'gyo',
  シャ: 'sha', シュ: 'shu', ショ: 'sho', ジャ: 'ja', ジュ: 'ju', ジョ: 'jo', シェ: 'she', ジェ: 'je',
  チャ: 'cha', チュ: 'chu', チョ: 'cho', チェ: 'che',
  ニャ: 'nya', ニュ: 'nyu', ニョ: 'nyo', ヒャ: 'hya', ヒュ: 'hyu', ヒョ: 'hyo',
  ビャ: 'bya', ビュ: 'byu', ビョ: 'byo', ピャ: 'pya', ピュ: 'pyu', ピョ: 'pyo',
  ミャ: 'mya', ミュ: 'myu', ミョ: 'myo', リャ: 'rya', リュ: 'ryu', リョ: 'ryo',
  ティ: 'ti', ディ: 'di', トゥ: 'tu', ドゥ: 'du', デュ: 'dyu',
  ファ: 'fa', フィ: 'fi', フェ: 'fe', フォ: 'fo',
  ウィ: 'wi', ウェ: 'we', ウォ: 'wo', ヴァ: 'va', ヴィ: 'vi', ヴェ: 've', ヴォ: 'vo',
};

/** ひらがな・カタカナ → ローマ字。かな以外の文字はそのまま残す */
export function kanaToRomaji(input: string): string {
  const s = input
    .normalize('NFKC')
    .replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  let out = '';
  let geminate = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === 'ッ') {
      geminate = true;
      continue;
    }
    if (c === 'ー') continue;
    const pair = s.slice(i, i + 2);
    let r = COMBO[pair];
    if (r) i++;
    else r = BASE[c];
    if (r === undefined) {
      out += c;
      geminate = false;
      continue;
    }
    if (geminate) out += r.startsWith('ch') ? 't' : r[0];
    geminate = false;
    out += r;
  }
  return out;
}

/** 検索語がかな（と空白・長音）だけのとき true。漢字や英字が混ざっていればそのまま投げれば足りる */
export function isKanaQuery(q: string): boolean {
  const s = q.normalize('NFKC').trim();
  return s !== '' && /^[ぁ-ゖァ-ヺー\s]+$/.test(s);
}
