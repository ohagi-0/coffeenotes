#!/usr/bin/env node
// 開発用サンプルデータ投入スクリプト（GitHub Issue #7）
//
//   pnpm seed:dev -- --email you@example.com --reset
//
// - service role キーで RLS を迂回し、指定したメールアドレスのユーザー所有データとして投入する。
// - 投入する ID はユーザー ID を名前空間にした UUID v5 なので、何度実行しても同じ行を上書きする（増えない）。
// - 画像（Storage / bean_images）は扱わない。Phase 2 の別チケット。
// - 店名・住所・記録の内容はすべて架空のサンプル。実在の店舗の情報ではない。

import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// 小道具
// ---------------------------------------------------------------------------

/** 異常終了。理由を出して終わる。 */
function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/** .env ファイルを読んで、未設定の環境変数だけ埋める（dotenv を依存に足さないための最小実装）。 */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** UUID v5（RFC 4122）。名前空間はユーザー ID、名前は 'bean:lusitania' のようなキー。 */
function uuidV5(namespaceUuid, name) {
  const ns = Buffer.from(namespaceUuid.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(Buffer.concat([ns, Buffer.from(name, 'utf8')]))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** n 日前の YYYY-MM-DD（ローカル時刻基準）。 */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** ロースター名の正規化。DB の生成列 roasters.name_normalized = lower(btrim(name)) と同じ規則。 */
function normalizeRoasterName(name) {
  return name.trim().toLowerCase();
}

/** Supabase のエラーをまとめて扱う。 */
function check(label, { error }) {
  if (error) fail(`${label} に失敗しました: ${error.message}${error.hint ? `（${error.hint}）` : ''}`);
}

// ---------------------------------------------------------------------------
// 投入するデータ（すべて架空のサンプル）
// ---------------------------------------------------------------------------

// ロースターは共有マスタ。既にあれば再利用し、重複登録しない。
// 自家焙煎の豆にもロースターが要る（F-BEAN-2 / F-BEAN-15）ため「自家焙煎」を 1 件置く。
const ROASTERS = [
  { name: 'KIELO COFFEE', website: 'https://kielocoffee.com' },
  { name: 'GLITCH COFFEE&ROASTERS', website: 'https://glitchcoffee.com' },
  { name: '自家焙煎', website: null },
];

// 4 件。カフェ 2 / ロースター 1 / 生豆販売店 1。みなもは座標なし（S6 の「座標なし」ピル確認用）。
const SHOPS = [
  {
    key: 'shop:aozora',
    name: 'アオゾラ珈琲店',
    kind: 'cafe',
    address: '東京都渋谷区恵比寿西 1-17',
    lat: 35.6465,
    lng: 139.7085,
  },
  {
    key: 'shop:hanare',
    name: 'ロースタリー ハナレ',
    kind: 'roaster',
    address: '東京都世田谷区奥沢 5-20',
    lat: 35.6072,
    lng: 139.6681,
  },
  {
    key: 'shop:minamo',
    name: '喫茶 みなも',
    kind: 'cafe',
    address: '東京都杉並区高円寺北 3-22',
    lat: null,
    lng: null,
  },
  {
    key: 'shop:matsumoto',
    name: '生豆倉庫 マツモト',
    kind: 'green_bean_shop',
    address: '長野県松本市中央 2-1',
    lat: 36.232,
    lng: 137.968,
  },
];

// 6 件。taste は [flavor, sweetness, acidity, aftertaste, body]。
// lusitania / hambela は 5 軸すべて、elpuente / kiriga は全 NULL（レーダーの有無を見るため）、
// shidamo は一部だけ埋めた中間状態。
const BEANS = [
  {
    key: 'bean:lusitania',
    name: 'Lusitania Lime Geisha',
    roaster: 'KIELO COFFEE',
    source: 'purchased',
    country: 'Colombia',
    region: 'Caicedonia, Valle del Cauca',
    variety: 'Geisha',
    process: 'Lime infused',
    altitude_m: 1650,
    flavor_notes: ['Lime', 'Bergamot', 'Laurier'],
    description: 'ライムを思わせるシトラスの香りと、ベルガモットのような華やかさ。後味に月桂樹のハーブ感。',
    taste: [5, 3, 5, 3, 3],
    price_jpy: 3800,
    price_grams: 100,
    roast_level: 'light',
    roasted_on: daysAgo(14),
    reference_url: 'https://kielocoffee.com/',
  },
  {
    key: 'bean:hambela',
    name: 'Hambela Buku Natural',
    roaster: 'GLITCH COFFEE&ROASTERS',
    source: 'purchased',
    country: 'Ethiopia',
    region: 'Guji, Hambela',
    variety: 'Heirloom',
    process: 'Natural',
    altitude_m: 2100,
    flavor_notes: ['Strawberry', 'Cacao nibs', 'Jasmine'],
    description: '完熟した苺のような甘さとカカオニブのほろ苦さ。冷めるとジャスミンの香りが立つ。',
    taste: [5, 5, 4, 4, 3],
    price_jpy: 2200,
    price_grams: 100,
    roast_level: 'light',
    roasted_on: daysAgo(22),
    reference_url: null,
  },
  {
    key: 'bean:elpuente',
    name: 'Finca El Puente Washed',
    roaster: 'KIELO COFFEE',
    source: 'purchased',
    country: 'Honduras',
    region: 'Marcala, La Paz',
    variety: 'Parainema',
    process: 'Washed',
    altitude_m: 1600,
    flavor_notes: ['Apple', 'Caramel', 'Black tea'],
    description: '青りんごの酸とキャラメルの甘さ。ミルクに合わせても輪郭が残る。',
    taste: [null, null, null, null, null],
    price_jpy: 1800,
    price_grams: 150,
    roast_level: 'medium',
    roasted_on: null,
    reference_url: null,
  },
  {
    key: 'bean:kiriga',
    name: 'Kiriga AA',
    roaster: 'GLITCH COFFEE&ROASTERS',
    source: 'purchased',
    country: 'Kenya',
    region: 'Nyeri, Kiriga',
    variety: 'SL28, SL34',
    process: 'Washed',
    altitude_m: 1750,
    flavor_notes: ['Blackcurrant', 'Tomato', 'Brown sugar'],
    description: null,
    taste: [null, null, null, null, null],
    price_jpy: 2400,
    price_grams: 100,
    roast_level: 'medium',
    roasted_on: null,
    reference_url: null,
  },
  {
    key: 'bean:esperanza',
    name: 'Nueva Esperanza Anaerobic',
    roaster: 'KIELO COFFEE',
    source: 'purchased',
    country: 'Guatemala',
    region: 'Huehuetenango',
    variety: 'Bourbon',
    process: 'Anaerobic natural',
    altitude_m: 1900,
    flavor_notes: ['Rum raisin', 'Cinnamon', 'Milk chocolate'],
    description: 'ラムレーズンとシナモン。発酵由来の甘い香りがはっきり出るロット。',
    taste: [4, 5, 3, 4, 4],
    price_jpy: 2600,
    price_grams: 100,
    roast_level: 'medium',
    roasted_on: null,
    reference_url: null,
  },
  {
    key: 'bean:shidamo',
    name: 'シダモ ベンサ（生豆）',
    roaster: '自家焙煎',
    source: 'home_roasted',
    country: 'Ethiopia',
    region: 'Sidama, Bensa',
    variety: 'Heirloom',
    process: 'Washed',
    altitude_m: 1950,
    flavor_notes: ['Lemon', 'Black tea', 'Honey'],
    description: '自分で焙煎する用に 500g 単位で買った生豆。浅めに寄せるとレモンの酸が出る。',
    taste: [4, null, 4, null, 3],
    price_jpy: 1600,
    price_grams: 500,
    roast_level: null,
    roasted_on: null,
    reference_url: null,
  },
];

// 自家焙煎バッチ（F-ROAST-1〜7）。
const ROASTS = [
  {
    key: 'roast:shidamo-1',
    bean: 'bean:shidamo',
    days: 30,
    method: '手回し焙煎機（ジェネカフェ）',
    green_grams: 200,
    roasted_grams: 168,
    duration_sec: 900,
    roast_level: 'medium_light',
    green_shop: 'shop:matsumoto',
    memo: '1 ハゼ開始 8 分 30 秒、2 ハゼ直前で排出。次回はもう 30 秒伸ばす。',
  },
];

// 15 件。直近約 2 か月。店 10 / 自宅 5、自宅のうち 2 件はレシピ入り・3 件は星とメモだけ。
// 星は 0.5 刻みでばらけさせ、log:15 だけ星なし。同じ豆を複数回飲んだ記録を含む（UC6）。
const LOGS = [
  {
    key: 'log:01',
    bean: 'bean:lusitania',
    place: 'shop',
    shop: 'shop:aozora',
    days: 1,
    rating: 4.5,
    brew_method: 'ハンドドリップ',
    memo: '一口目からライム。冷めるほど香りが立つ。',
    tags: ['朝', 'ゲイシャ', 'インフューズド'],
  },
  {
    key: 'log:02',
    bean: 'bean:shidamo',
    place: 'home',
    roast: 'roast:shidamo-1',
    days: 3,
    rating: 4.0,
    brew_method: 'ハンドドリップ（ORIGAMI）',
    recipe: {
      grinder: 'Comandante C40',
      grind_setting: '25 クリック',
      dose_g: 15,
      water_g: 240,
      water_temp_c: 92,
      brew_time_sec: 165,
      recipe_memo: '40g で 40 秒蒸らし、そのあと 3 投。',
    },
    memo: '焙煎から 3 週間。レモンの酸が落ち着いて甘さが出てきた。',
    tags: ['浅煎り'],
  },
  {
    key: 'log:03',
    bean: 'bean:hambela',
    place: 'shop',
    shop: 'shop:hanare',
    days: 5,
    rating: 5.0,
    brew_method: 'ハンドドリップ',
    memo: '苺のシロップみたいな甘さ。今年飲んだ中で一番。',
    tags: ['浅煎り', '再訪したい'],
  },
  {
    key: 'log:04',
    bean: 'bean:lusitania',
    place: 'home',
    days: 8,
    rating: 4.0,
    memo: '急いでいたので分量は目分量。それでも十分おいしい。',
    tags: ['朝', 'インフューズド'],
  },
  {
    key: 'log:05',
    bean: 'bean:elpuente',
    place: 'shop',
    shop: 'shop:aozora',
    days: 11,
    rating: 3.5,
    brew_method: 'エスプレッソ',
    memo: 'キャラメルの甘さ。ミルクに合わせても負けない。',
    tags: ['再訪したい'],
  },
  {
    key: 'log:06',
    bean: 'bean:kiriga',
    place: 'shop',
    shop: 'shop:hanare',
    days: 14,
    kind: 'bought',
    purchased_grams: 100,
    rating: 4.5,
    brew_method: 'ハンドドリップ',
    memo: '試飲してそのまま 100g 購入。黒すぐりのような酸。',
  },
  {
    key: 'log:07',
    bean: 'bean:hambela',
    place: 'home',
    days: 17,
    rating: 4.5,
    brew_method: 'エアロプレス',
    recipe: {
      grinder: '1Zpresso JX-Pro',
      grind_setting: '2-4-0',
      dose_g: 14,
      water_g: 200,
      water_temp_c: 88,
      brew_time_sec: 120,
      recipe_memo: 'インバートで 1 分半浸漬、30 秒かけて押す。',
    },
    memo: '低めの温度で淹れたら苺感がはっきり出た。',
    tags: ['朝', '浅煎り'],
  },
  {
    key: 'log:08',
    bean: 'bean:esperanza',
    place: 'shop',
    shop: 'shop:aozora',
    days: 20,
    rating: 3.0,
    brew_method: 'ハンドドリップ',
    memo: 'ラムレーズンが強い。好みからは少し外れる。',
    tags: ['浅煎り'],
  },
  {
    key: 'log:09',
    bean: 'bean:lusitania',
    place: 'shop',
    shop: 'shop:minamo',
    days: 23,
    rating: 5.0,
    brew_method: 'ハンドドリップ',
    memo: '同じ豆でも淹れ手が違うとここまで変わる。',
    tags: ['ゲイシャ', 'インフューズド', '再訪したい'],
  },
  {
    key: 'log:10',
    bean: 'bean:shidamo',
    place: 'home',
    roast: 'roast:shidamo-1',
    days: 27,
    rating: 3.5,
    memo: '焙煎 3 日目。まだガスが多くて味が乗らない。',
  },
  {
    key: 'log:11',
    bean: 'bean:elpuente',
    place: 'home',
    days: 31,
    rating: 2.5,
    memo: '湯温が高すぎたのか渋い。次は 88 度で。',
  },
  {
    key: 'log:12',
    bean: 'bean:esperanza',
    place: 'shop',
    shop: 'shop:hanare',
    days: 36,
    rating: 4.0,
    brew_method: 'アイス',
    memo: 'アイスにすると甘さが締まって良い。',
    tags: ['再訪したい'],
  },
  {
    key: 'log:13',
    bean: 'bean:hambela',
    place: 'shop',
    shop: 'shop:minamo',
    days: 41,
    rating: 2.0,
    brew_method: 'ハンドドリップ',
    memo: '豆が古かったのか香りが飛んでいた。',
  },
  {
    key: 'log:14',
    bean: 'bean:kiriga',
    place: 'shop',
    shop: 'shop:aozora',
    days: 48,
    rating: 1.0,
    brew_method: 'アイス',
    memo: '氷が溶けすぎて水っぽい。頼み方を間違えた。',
  },
  {
    key: 'log:15',
    bean: 'bean:shidamo',
    place: 'shop',
    shop: 'shop:matsumoto',
    days: 56,
    kind: 'bought',
    purchased_grams: 500,
    rating: null,
    memo: '生豆を 500g 購入。エチオピア ベンサ。',
  },
];

const TAG_NAMES = ['朝', 'ゲイシャ', 'インフューズド', '浅煎り', '再訪したい'];

// ---------------------------------------------------------------------------
// 本体
// ---------------------------------------------------------------------------

const USAGE = `使い方:
  pnpm seed:dev -- --email <ログインに使っているメールアドレス> [--reset] [--yes]

  --email <address>  投入先のユーザー。Supabase の auth.users から ID を引く（必須）
  --reset            そのユーザーの logs / roasts / beans / shops / tags を先に全削除する
  --yes              接続先の確認プロンプトを省略する
`;

function parseCliArgs() {
  try {
    return parseArgs({
      options: {
        email: { type: 'string' },
        reset: { type: 'boolean', default: false },
        yes: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
      allowPositionals: false,
    }).values;
  } catch (e) {
    fail(`${e instanceof Error ? e.message : String(e)}\n\n${USAGE}`);
  }
}

async function confirm(question) {
  if (!process.stdin.isTTY) {
    fail('確認を取れない環境です。内容を確かめたうえで --yes を付けて実行してください。');
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim().toLowerCase() === 'y';
}

/** メールアドレスからユーザーを探す。admin API には getUserByEmail が無いので一覧を辿る。 */
async function findUserByEmail(sb, email) {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`ユーザー一覧の取得に失敗しました: ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

/** 共有マスタのロースターを用意する。既存は再利用し、足りないものだけ足す。 */
async function ensureRoasters(sb, userId) {
  const normalized = ROASTERS.map((r) => normalizeRoasterName(r.name));
  const existing = await sb
    .from('roasters')
    .select('id, name, name_normalized')
    .in('name_normalized', normalized);
  check('ロースターの検索', existing);

  const byNormalized = new Map(existing.data.map((r) => [r.name_normalized, r.id]));
  const missing = ROASTERS.filter((r) => !byNormalized.has(normalizeRoasterName(r.name)));

  if (missing.length > 0) {
    const inserted = await sb
      .from('roasters')
      .insert(missing.map((r) => ({ name: r.name, website: r.website, created_by: userId })))
      .select('id, name, name_normalized');
    check('ロースターの登録', inserted);
    for (const r of inserted.data) byNormalized.set(r.name_normalized, r.id);
  }

  const byName = new Map(ROASTERS.map((r) => [r.name, byNormalized.get(normalizeRoasterName(r.name))]));
  return { byName, created: missing.length, reused: ROASTERS.length - missing.length };
}

/** そのユーザーのデータを消す。roasters は共有マスタなので触らない。 */
async function resetUserData(sb, userId) {
  // log_tags と bean_images は FK の ON DELETE CASCADE で一緒に消える。
  for (const table of ['logs', 'roasts', 'beans', 'shops', 'tags']) {
    check(`${table} の削除`, await sb.from(table).delete().eq('user_id', userId));
  }
}

async function main() {
  const args = parseCliArgs();
  if (args.help) {
    console.log(USAGE);
    return;
  }

  loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
  loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!args.email) fail(`--email を指定してください。\n\n${USAGE}`);
  if (!url) fail('NEXT_PUBLIC_SUPABASE_URL が未設定です。.env.local を確認してください。');
  if (!serviceRoleKey) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY が未設定です。\n' +
        '  Supabase ダッシュボード → Settings → API Keys の service_role キーを .env.local に追記してください。\n' +
        '  このキーは RLS を迂回します。ブラウザに渡さない・コミットしない。',
    );
  }

  // 接続先を見せてから実行する（本番プロジェクトへの誤爆防止）
  console.log('');
  console.log('  接続先          :', url);
  console.log('  対象ユーザー    :', args.email);
  console.log('  既存データの削除:', args.reset ? 'する（--reset）' : 'しない');
  console.log('');
  if (!args.yes && !(await confirm('この接続先にサンプルデータを投入します。よろしいですか? (y/N): '))) {
    console.log('中止しました。');
    return;
  }

  const sb = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const user = await findUserByEmail(sb, args.email);
  if (!user) {
    fail(
      `${args.email} のユーザーが見つかりません。\n` +
        '  先にアプリからマジックリンクでログインして、auth.users に登録してください。',
    );
  }
  console.log(`\n→ ユーザー ${user.email}（${user.id}）として投入します。`);

  if (args.reset) {
    await resetUserData(sb, user.id);
    console.log('→ 既存の logs / roasts / beans / shops / tags を削除しました。');
  }

  const id = (key) => uuidV5(user.id, key);

  // ロースター（共有マスタ）
  const roasters = await ensureRoasters(sb, user.id);
  console.log(`→ ロースター: 新規 ${roasters.created} 件 / 既存を再利用 ${roasters.reused} 件`);

  // 店
  const shopRows = SHOPS.map((s) => ({
    id: id(s.key),
    user_id: user.id,
    name: s.name,
    kind: s.kind,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    external_place_id: null,
  }));
  check('店の投入', await sb.from('shops').upsert(shopRows, { onConflict: 'id' }));

  // 豆
  const beanRows = BEANS.map((b) => ({
    id: id(b.key),
    user_id: user.id,
    roaster_id: roasters.byName.get(b.roaster),
    name: b.name,
    country: b.country,
    region: b.region,
    variety: b.variety,
    process: b.process,
    altitude_m: b.altitude_m,
    flavor_notes: b.flavor_notes,
    description: b.description,
    taste_flavor: b.taste[0],
    taste_sweetness: b.taste[1],
    taste_acidity: b.taste[2],
    taste_aftertaste: b.taste[3],
    taste_body: b.taste[4],
    price_jpy: b.price_jpy,
    price_grams: b.price_grams,
    roast_level: b.roast_level,
    source: b.source,
    roasted_on: b.roasted_on,
    reference_url: b.reference_url,
    ocr_raw: null,
  }));
  check('豆の投入', await sb.from('beans').upsert(beanRows, { onConflict: 'id' }));

  // 焙煎バッチ
  const roastRows = ROASTS.map((r) => ({
    id: id(r.key),
    user_id: user.id,
    bean_id: id(r.bean),
    roasted_on: daysAgo(r.days),
    method: r.method,
    green_grams: r.green_grams,
    roasted_grams: r.roasted_grams,
    duration_sec: r.duration_sec,
    roast_level: r.roast_level,
    green_shop_id: r.green_shop ? id(r.green_shop) : null,
    memo: r.memo,
  }));
  check('焙煎バッチの投入', await sb.from('roasts').upsert(roastRows, { onConflict: 'id' }));

  // 記録
  const logRows = LOGS.map((l) => ({
    id: id(l.key),
    user_id: user.id,
    bean_id: id(l.bean),
    roast_id: l.roast ? id(l.roast) : null,
    shop_id: l.place === 'shop' && l.shop ? id(l.shop) : null,
    kind: l.kind ?? 'drank',
    place: l.place,
    logged_on: daysAgo(l.days),
    rating: l.rating ?? null,
    brew_method: l.brew_method ?? null,
    grinder: l.recipe?.grinder ?? null,
    grind_setting: l.recipe?.grind_setting ?? null,
    dose_g: l.recipe?.dose_g ?? null,
    water_g: l.recipe?.water_g ?? null,
    water_temp_c: l.recipe?.water_temp_c ?? null,
    brew_time_sec: l.recipe?.brew_time_sec ?? null,
    recipe_memo: l.recipe?.recipe_memo ?? null,
    memo: l.memo ?? null,
    purchased_grams: l.purchased_grams ?? null,
    photo_path: null,
  }));
  check('記録の投入', await sb.from('logs').upsert(logRows, { onConflict: 'id' }));

  // タグ（user_id + name が一意。既存があればその ID を使う）
  const tagUpsert = await sb
    .from('tags')
    .upsert(
      TAG_NAMES.map((name) => ({ id: id(`tag:${name}`), user_id: user.id, name })),
      { onConflict: 'user_id,name' },
    )
    .select('id, name');
  check('タグの投入', tagUpsert);
  const tagIdByName = new Map(tagUpsert.data.map((t) => [t.name, t.id]));

  const logTagRows = LOGS.flatMap((l) =>
    (l.tags ?? []).map((name) => ({ log_id: id(l.key), tag_id: tagIdByName.get(name), user_id: user.id })),
  );
  check('記録とタグの紐付け', await sb.from('log_tags').upsert(logTagRows, { onConflict: 'log_id,tag_id' }));

  // 件数を数え直して報告する
  const counts = {};
  for (const table of ['shops', 'beans', 'roasts', 'logs', 'tags']) {
    const res = await sb.from(table).select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    check(`${table} の件数取得`, res);
    counts[table] = res.count;
  }

  console.log('\n✓ 投入が終わりました（このユーザーの現在の件数）');
  console.log(`  店     : ${counts.shops}（うち座標なし ${SHOPS.filter((s) => s.lat === null).length}）`);
  console.log(`  豆     : ${counts.beans}`);
  console.log(`  焙煎   : ${counts.roasts}`);
  console.log(`  記録   : ${counts.logs}`);
  console.log(`  タグ   : ${counts.tags}`);
  console.log('');
}

await main();
