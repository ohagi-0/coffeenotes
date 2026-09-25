# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

コーヒー記録アプリ **coffeenotes**。このファイルは Claude Code がこのリポジトリで作業するときの前提・ルールをまとめたもの。
要件の詳細は `docs/REQUIREMENTS.md` を正とする。矛盾があれば REQUIREMENTS.md を優先し、このファイルを直す。

## 1. プロジェクト概要

飲んだコーヒー豆をテイスティングカードの写真から半自動で記録し、店・星評価・タグと紐づけて一覧/検索/地図/統計で振り返る **スマホ向け PWA**。店で飲んだ記録も、自宅で挽いて淹れた記録（レシピ付き）も、自家焙煎した豆の記録も同じ軽さで残せる。複数ユーザーが各自のプライベートな記録帳として使う。**将来 Capacitor で iOS/Android アプリとして配信する**（REQUIREMENTS.md §13）。

- 開発者: 個人（Kota）。レビュー相手は Claude Code。
- 規模目標: 個人〜数十ユーザー。ランニングコストは月 0〜数百円。
- **想定ユーザー: コーヒーに詳しい人だけではなく、ライト層も使う**（2026-09-24 決定）。店で「ブルーマウンテン」と書かれた豆を記録した人が、アプリの中で「ティピカ」の棚に入れられても意味が分からない。専門的な正しさ（植物学上の品種、精製方法の分類など）より、**その人がお店で見た言葉のまま出てくること**を優先する。分類・集計・棚分けの軸を決めるときはこの観点を第一にする（§5.3）。
- 現在のフェーズ: **Phase 0〜5 の実装が完了**（2026-09-22）。ユーザー側の設定（Anthropic API キー、Google OAuth）は 2026-09-24 に完了。実機確認（ログイン、カード読み取り、地図、分析、エクスポート、PWA のオフライン閲覧）も 2026-09-24 に完了。残りは UI の微調整と Phase 6（Capacitor）。フェーズ定義は REQUIREMENTS.md §10。
- 作業の分担: UI / 非 UI の固定分担は 2026-09-22 に終了（Issue #4〜#24 完了）。ただし同じワーキングツリーで複数の Claude Code ウィンドウが同時に動くことは今もある（2026-09-24 も OCR とドキュメントを別ウィンドウで並行）。必ず §3.1「並行作業の注意」に従い、自分が触ったパスだけを `git add` する。

## 2. 技術スタック（確定分）

| レイヤ | 採用 | 備考 |
|---|---|---|
| フレームワーク | Next.js 15 系 App Router + TypeScript（strict） | `src/` 構成。**静的出力（`output: 'export'`）可能な範囲で書く**（§2.2） |
| OCR | Claude Haiku 4.5 Vision（Anthropic SDK） | `src/lib/ocr/providers/claude.ts`。`/api/ocr` からのみ呼ぶ |
| UI | Tailwind CSS + shadcn/ui | スマホ幅（375px）を基準にデザイン |
| PWA | serwist | オフライン時は閲覧のみ |
| BaaS | Supabase（Postgres / Auth / Storage） | RLS 必須。`supabase/migrations` で管理 |
| データ取得 | Supabase JS v2 + TanStack Query | 画面はブラウザから直接叩く。`@supabase/ssr` は Route Handler 用の `src/lib/supabase/server.ts` でのみ使う |
| バリデーション | Zod | フォーム・API・OCR 出力すべてに適用 |
| 地図 | react-leaflet + OpenStreetMap タイル | API キー不要 |
| QR | @zxing/browser | ブラウザ内で完結 |
| テスト | Vitest（単体）+ Playwright（E2E、主要フローのみ） | |
| Lint / Format | ESLint（next/core-web-vitals）+ Prettier | コミット前に `pnpm lint && pnpm typecheck` |
| パッケージ管理 | pnpm | `npm` / `yarn` を混ぜない |
| ホスティング | Vercel Hobby | 本番 **https://coffee-notes.app**（Cloudflare Registrar で取得、DNS は Cloudflare、プロキシ OFF）。旧 URL https://coffeenotes-red.vercel.app は本体へ転送。プロジェクト `coffeenotes`。**GitHub 連携済み**（`ohagi-0/coffeenotes`、本番ブランチ `main`。2026-09-24 確認）なので `main` への push で自動デプロイされる。急ぐときは `vercel deploy --prod` でも可 |

### 2.1 決定済み事項（2026-09-21）— 勝手に変えない

| 項目 | 決定 | 実装上の扱い |
|---|---|---|
| OCR エンジン | Claude Haiku 4.5 Vision | `OcrProvider` 抽象化は維持（§5.2） |
| 店候補・ジオコーディング | まず Nominatim。**店名・住所の手入力と地図タップでの位置指定は Must** | `GeoProvider` 抽象化。候補検索は入力補助であり、失敗しても手入力で店を作れること |
| ログイン方式 | メールリンク + Google の両方 | Supabase Auth で両プロバイダ有効化。同一メールは同一アカウント |
| 星の刻み | 0.5 刻み（1.0〜5.0） | DB `numeric(2,1)`。UI は星の左右半分タップ |
| ロースター名 | 全ユーザー共通マスタ | `roasters` は RLS で読み取り全員可・INSERT は認証ユーザー可・UPDATE/DELETE は作成者のみ |
| 配信形態 | PWA 先行、後に Capacitor | §2.2 |
| 詳細ページの URL | クエリ文字列（`/beans?id=…` `/logs?id=…` `/shops/detail?id=…`）。ADR 0008 | `src/app/` に `[id]` などの動的セグメントを置かない（静的出力で落ちる）。URL は `src/lib/routes.ts` 経由で組み立て、詳細ページは `useSearchParams` を `Suspense` の中で読む |

新しい未確定項目が出たら、**仮実装で進めずにユーザーに確認し、REQUIREMENTS.md §8.3 に追記する**。

### 2.2 ネイティブ化（Capacitor）のために守る制約

REQUIREMENTS.md §13.2 の N-1〜N-5。要点:

- 画面はすべてクライアント側で描画できること。サーバーコンポーネントでデータ取得しない（Supabase はブラウザから直接叩く）。
- `/api/*` は **`NEXT_PUBLIC_API_BASE_URL` を前置した絶対 URL** で呼ぶ。相対パス `fetch('/api/ocr')` は禁止。
- ブラウザ API（カメラ、位置情報、共有）は `src/lib/platform/` のラッパー経由。直接 `navigator.*` を UI から呼ばない。
- 認証のリダイレクト先は Web URL とカスタムスキームの両方を Supabase に登録する。

## 3. ディレクトリ構成

```
.
├── CLAUDE.md
├── docs/
│   ├── REQUIREMENTS.md        # 要件定義書（正）
│   ├── DESIGN.md              # 画面の基本設計（トークン・部品・画面仕様）。design/ はモック（GitHub Pages）
│   ├── USER-SETUP.md          # ユーザー側の設定手順（API キー、Google ログイン、実機確認、Vercel×GitHub）
│   ├── worklog/               # UI 実装の作業ログ（履歴。読むのは経緯を調べるときだけ）
│   └── decisions/             # ADR: 決めたことを 1 ファイル 1 決定で残す
├── src/
│   ├── app/                   # App Router（route ごとにフォルダ）
│   │   ├── (auth)/login/
│   │   ├── (legal)/           # /privacy /terms（ログイン不要。Google 同意画面・App Store 申請の参照先）
│   │   ├── (app)/             # ログイン後。layout に認証ガード + ナビ（Web はサイトヘッダー + ドロワー、PC はサイドバー、下タブは iOS 版のみ）
│   │   │   ├── page.tsx       # ホーム = 豆のコレクション（棚。S10。2026-09-24 にホームへ）
│   │   │   ├── logs/new/      # 記録作成ウィザード
│   │   │   ├── logs/              # id なしは入力記録一覧 `/logs?f=…&q=…`、id ありは記録詳細・編集 `/logs?id=…`（ADR 0008。[id] は使わない）
│   │   │   ├── beans/             # 豆詳細 `/beans?id=…`
│   │   │   ├── shops/             # 記録したお店 = 地図 + 一覧（`/shops?shop=…&f=…`。Leaflet は dynamic import）。詳細は shops/detail/ `/shops/detail?id=…`
│   │   │   ├── map/               # 旧地図。`/shops` へ転送するだけ（2026-09-24 に統合）
│   │   │   ├── stats/             # 好みの分析 `/stats?p=…`
│   │   │   ├── settings/
│   │   │   └── dev/components/    # 部品カタログ。本番は notFound()
│   │   ├── auth/callback/     # マジックリンク・OAuth の戻り先（ガードの外）
│   │   ├── sw.ts              # Service Worker（serwist）。public/sw.js に生成される
│   │   └── api/               # Route Handler。ocr/route.ts（Claude Haiku）、geo/route.ts（店候補）。静的出力からは除外される
│   │       ├── ocr/route.ts   # OCR 実行（API キーはここでのみ使う）
│   │       └── geo/route.ts   # 店候補・ジオコーディング
│   ├── components/
│   │   ├── ui/                # shadcn/ui 生成物（手で編集しない）
│   │   ├── beans/  logs/  shops/  map/  roasts/  settings/  form/
│   ├── features/              # ドメインごとのロジック（hooks, queries, mutations）
│   │   ├── beans/  logs/  shops/  roasters/  roasts/  tags/  auth/  geo/  stats/  export/  settings/
│   │   ├── ocr/               # /api/ocr の呼び出し、抽出→フォーム変換、撮影画像の受け渡し、今日の回数
│   │   ├── account/           # アカウント削除（Storage 掃除 → delete_my_account()）
│   ├── lib/
│   │   ├── supabase/          # client.ts（ブラウザ、シングルトン）/ server.ts（Route Handler 用）。middleware.ts は作らない
│   │   ├── ocr/               # index.ts(インターフェース) + providers/
│   │   ├── geo/               # index.ts(インターフェース) + providers/
│   │   ├── image/             # compress.ts（長辺 1,600px）/ data-url.ts / qr.ts（@zxing/browser）
│   │   ├── storage/           # Supabase Storage（カード画像の保存・署名付き URL）
│   │   ├── platform/          # camera / geolocation / share / network / download（ブラウザ API はここだけ。Capacitor で差し替える）
│   │   ├── routes.ts          # 画面 URL の組み立て（詳細ページはクエリ形式。ADR 0008）
│   │   ├── vocab/             # 生産国・品種の語彙（別名表 → 日本語の呼び名、棚の順、入力候補）。棚・絞り込み・分析・フォームはここだけを見る（ADR 0009）
│   │   └── schemas/           # Zod スキーマ（DB 型と対応。フォーム用と DB 投入用を分ける）
│   └── types/
│       └── database.ts        # `supabase gen types` の生成物（手で編集しない）
├── supabase/
│   ├── migrations/            # SQL。RLS ポリシーも必ずここに書く
│   ├── seed.sql
│   └── config.toml
├── public/                    # manifest.json, icons
├── scripts/               # seed-dev.mjs（サンプルデータ投入。要 SUPABASE_SERVICE_ROLE_KEY）
└── tests/
    ├── unit/                  # Vitest。setup.ts で jest-dom を読み込む
    ├── e2e/                   # Playwright。Pixel 7 相当、ポート 3100
    └── fixtures/cards/        # OCR テスト用のサンプル画像（実 API は叩かない）
```

### 3.1 仕組みの要点（複数ファイルにまたがるもの）

- **認証の流れ**: `src/app/page.tsx` がセッションの有無で `/`（`(app)`）か `/login` に振り分ける。`(app)/layout.tsx` が `useSession()`（`src/features/auth/use-session.ts`）でクライアント側にガードし、未ログインなら `/login` へ。ミドルウェアは使わない（静的出力のため）。`src/app/auth/callback/page.tsx` はガードの外にあり、マジックリンクの `?code=`（ブラウザクライアントが自動交換）と `token_hash`（`verifyOtp`）の両方を処理する。
- **環境変数**: `src/lib/env.ts` の `getPublicEnv()` / `getServerEnv()` は呼び出し時に Zod 検証する（モジュール直下で読むとビルド時のプリレンダーで落ちる）。`/api/*` の URL は `apiUrl('/api/…')`、認証の戻り先は `authCallbackUrl()` で組み立て、どちらも `NEXT_PUBLIC_API_BASE_URL` 基点の絶対 URL になる。
- **Supabase クライアント**: ブラウザは `getSupabaseBrowserClient()` の 1 つだけ。Route Handler は `createRouteClient(request)` が `Authorization: Bearer` を優先し（ネイティブ版は Cookie を送れない）、無ければ Cookie を使う。`createServiceClient()` は RLS を無視するのでアカウント削除など限定用途のみ。
- **Zod スキーマの二層構造**（`src/lib/schemas/`）: 各エンティティに `xxxFormSchema`（フォーム入力用。空文字・数値文字列を `common.ts` の `emptyToNull` / `numberOrNull` / `textOrNull` で null か値に寄せる）と `xxxInsertSchema`（= Form + `user_id`。DB 投入用）がある。DB の CHECK 制約（座標は対、自宅は店 NULL、星 0.5 刻み、味覚 1〜5）は同じ規則をクライアント側でも `refine` で検証する。末尾の `type _XxxInsertCompat = Expect<Extends<XxxInsert, Database[...]['Insert']>>` は `database.ts` の Insert 型に代入できることをコンパイル時に保証するので、`pnpm db:types` で型を再生成したら `pnpm typecheck` でここが最初に落ちる。`index.ts` から一括 export。
- **TanStack Query のキー**: `src/features/<domain>/queries.ts` に `logKeys` のようなキー生成オブジェクトを置き、`useXxx` フックはそれを使う。無効化もこのキー経由。
- **Next.js の `typedRoutes: true`**: `<Link href>` の文字列は存在するルートしか受け付けない。ルートを増やす前に `href` を書くと typecheck で落ちる。
- **RLS の前提**: ユーザー所有テーブルへの INSERT は `user_id` をセッションから明示的に入れる（DB 側に既定値は無い）。`log_tags.user_id` も NOT NULL。`roasters` の INSERT は `created_by = auth.uid()` が条件。ロースター名は生成列 `name_normalized` に一意制約があり、同名登録は Postgres の `23505` になる。
- **静的出力との関係**（2026-09-22 検証）: 現状のコードは `output: 'export'` でビルドが通る。`/api/*` は自動で除外される（Vercel 側が配信し、アプリは本番 URL 経由で呼ぶ）。動的ルート `[id]` は落ちるので使わない（ADR 0008。URL は `src/lib/routes.ts` で組み立てる）。
- **Prettier の対象外**: Markdown と `docs/design/` は整形しない。`pnpm format` を打っても要件書やモックは変わらない。
- **カード読み取りの流れ**（Phase 2）: `/logs/new?step=capture` で OS カメラ→`compressImage`→data URL を sessionStorage（`features/ocr/capture-draft.ts`）→`?step=ocr` が `/api/ocr` を Bearer 付き絶対 URL で呼ぶ→`extractionToBeanForm` で `BeanForm` の `defaultValues` と `confidence`→③保存で豆を作ってから Storage へ画像と `bean_images` 行、`ocr_raw`。上限は DB 関数 `consume_ocr_quota()`（50 回/日、日本時間）。`OCR_PROVIDER=none` なら 503 で手入力へ。
- **店候補**（Phase 3）: `/api/geo`（認証必須）→ `GeoProvider`。`nearby` は Overpass（amenity=cafe / shop=coffee）、`geocode` は Nominatim（日本限定、ja）。公開サーバーなので User-Agent を付け、結果は 60 秒キャッシュ。
- **アカウント削除**（F-AUTH-3）: service role は使わない。クライアントが Storage の自分のプレフィックスを消してから DB 関数 `delete_my_account()`（SECURITY DEFINER）を呼び、ローカルの signOut。
- **並行作業の注意**: UI ウィンドウと同じワーキングツリーを共有している。`git add -A` や `git commit -a` は相手の作業途中ファイルを巻き込むので、**自分が触ったパスだけを `git add` する**。UI 側の担当は `src/app/**`、`src/components/**`、`public/manifest.json`、`docs/DESIGN.md`、`docs/design/**`。非 UI 側は `src/lib/**`、`src/features/**`、`supabase/**`、`scripts/**`、`tests/**`。

## 4. データモデルの要点

詳細は REQUIREMENTS.md §4。実装時に守ること:

- **豆（beans）と記録（logs）は別テーブル**。同じ豆を複数回飲む前提。
- `beans.source` は `purchased` / `home_roasted`。自家焙煎の豆は `roasts`（焙煎バッチ）を 1 件以上持ち、`logs.roast_id` でどのバッチを飲んだかを指す。
- `logs.place` は `shop` / `home`。`home` のときは `shop_id` を NULL にし、レシピ列（grinder / grind_setting / dose_g / water_g / water_temp_c / brew_time_sec / recipe_memo）を使う。レシピ列はすべて NULL 可で、**星とメモだけでも保存できる**こと。
- 全ユーザー所有テーブルは `user_id` を持ち、**RLS で `auth.uid() = user_id` を強制**。RLS の無いテーブルを作らない。
- `roasters` は共有マスタ（読み取り全員可、INSERT 認証ユーザー可、UPDATE/DELETE は `created_by` 本人のみ）。登録時は `name` の大文字小文字・前後空白を正規化して重複を避ける。
- `shops` は `lat` / `lng` が NULL でも保存可。地図には座標のある店だけ出す。
- 味覚チャートは `taste_flavor` など 5 列の `smallint 1〜5`、NULL 可。
- 画像は Supabase Storage のバケット `bean-images`、パスは `{user_id}/{bean_id}/{front|back}.jpg`。Storage ポリシーもプレフィックスで制限。
- 星は `numeric(2,1)`、0.5 刻み（決定）。CHECK 制約で `rating * 2` が整数かつ 1.0〜5.0 を保証。
- スキーマ変更は必ず `supabase/migrations/` に SQL を追加し、`pnpm db:types` で `src/types/database.ts` を再生成する。ダッシュボードから直接いじらない。

## 5. コーディング規約

### 5.1 一般

- TypeScript strict。`any` 禁止（やむを得ない場合は `unknown` + 型ガード）。
- サーバー/クライアント境界を明示: クライアントコンポーネントは先頭に `'use client'`、Supabase の service role キーや外部 API キーは **`src/app/api/` と Server Actions の中でしか参照しない**。
- 環境変数は `src/lib/env.ts` で Zod 検証してから使う。ブラウザに出してよいのは `NEXT_PUBLIC_` 接頭辞のみ。
- 命名: ファイルは kebab-case、コンポーネントは PascalCase、hooks は `useXxx`。
- コメント・コミットメッセージ・UI 文言は日本語。コード識別子は英語。
- 日付は DB では `date` / `timestamptz`、表示は `date-fns` + `ja` ロケール。

### 5.2 OCR / geo のプロバイダ抽象化（最重要）

```ts
// src/lib/ocr/index.ts
export interface OcrProvider {
  readonly name: string;
  extractBeanCard(images: { front: Blob; back?: Blob }): Promise<OcrResult>;
}
// OcrResult = { extraction: BeanCardExtraction; raw: unknown; provider; model; durationMs }
// BeanCardExtraction は Zod スキーマ (src/lib/schemas/bean-card.ts) で定義。
// 各項目は { value, confidence } の形で返し、UI で低信頼度を強調できるようにする。raw は beans.ocr_raw に保存する。
```

- プロバイダは `src/lib/ocr/providers/claude.ts`（`OCR_PROVIDER=claude`）。選択は `src/lib/ocr/factory.ts`（サーバー専用）。`none` なら `/api/ocr` は 503 `ocr_disabled` を返し、UI は手入力に切り替える。
- Claude 実装の要点: モデル `claude-haiku-4-5`、表・裏を 1 リクエスト、`tool_use`（`strict: true`、`tool_choice` で強制）で JSON を出させ、`sanitizeExtraction` で揺れを落としてから Zod 検証。**ツールの input_schema は「値はフラット + `confidence` オブジェクト」**（`BEAN_CARD_FIELDS`）。アプリ側の項目ごと `{ value, confidence }` の形を入れ子のまま strict に渡すと「compiled grammar is too large」で 400、配列型 `['integer','null']` と `enum` の併用も 400 になる（2026-09-24 実 API で確認）。strict スキーマは初回に文法コンパイルが走り 15〜30 秒かかるが、以後 24 時間はキャッシュされる（上記のウォームアップで切らさない）。`max_tokens` 1,024、タイムアウト 30 秒（初回コンパイルが重なってもリトライ無しで通る長さ）。**`/api/ocr/warm`**（`CRON_SECRET` の Bearer 認証、上限は消費しない）が `OcrProvider.warmUp()` で同じスキーマを画像なしで 1 回呼び、`.github/workflows/ocr-warmup.yml` が 12 時間ごとに叩いて文法キャッシュを切らさない。1 ユーザー 1 日 50 回の上限は DB 関数 `consume_ocr_quota()`（SECURITY DEFINER、上限値は DB 側に固定、`ocr_usage` テーブル）で数え、`/api/ocr` がプロバイダを呼ぶ前に消費する。
- **アプリ本体は `OcrProvider` 以外を import しない**。
- 低信頼度の判定は `LOW_CONFIDENCE_THRESHOLD`（`src/lib/schemas/bean-card.ts`、現在 0.6）を使い、UI や設計書に数値を直書きしない。
- OCR 失敗時は例外を握りつぶさず、UI は「手入力に切り替える」導線を出す。
- `beans.ocr_raw` にプロバイダの生出力を保存する（再抽出・方式比較用）。
- geo も同じ構造（`GeoProvider.searchNearby` / `geocode`）。

### 5.3 UI

- **ライト層のユーザー体験を第一にする**（§1）。棚・フィルタ・統計の見出しは、ユーザーが入力した言葉（店のカードにある表記）で出す。専門分類に寄せて別の名前に置き換えない（ブルーマウンテンをティピカに、など）。専門用語（アラビカ / ロブスタ、系統名）は豆の情報として持ってよいが、棚や見出しのタイトルにはしない。表記ゆれ（英語 / カタカナ、略称）は別名表で同じ棚に寄せてよいが、見出しは日本語の一般的な呼び名にする。
- 色・書体・部品・画面仕様は `docs/DESIGN.md` に従う（ダーク専用、銅は操作要素だけ、豆名は Bodoni Moda、数字は Manrope、日本語は端末フォント）。
- ナビは Web ではサイトヘッダー（ワードマーク、「＋ 記録する」、メニュー）+ 右からのドロワー + フッター。下タブは iOS アプリ版だけ（ADR 0007 追記）。ナビとページ名は略称を使わず「入力記録一覧 / 記録したお店 / 好みの分析 / 設定」で統一する（DESIGN.md §3。地図は 2026-09-24 に「記録したお店」へ統合、`/map` は転送。戻すなら git タグ `before-shops-map-merge`）。
- モバイルファースト。ボタン・タップ領域は 44px 以上。
- フォームは react-hook-form + Zod resolver。OCR 結果はフォームの `defaultValues` に流し込むだけにし、確定は必ずユーザー操作。
- 画像は保存前に `src/lib/image/compress.ts` で長辺 1,600px・JPEG 品質 0.8 に圧縮する。
- ローディング・空状態・エラー状態を必ず実装する（3 状態が無いコンポーネントはレビューで差し戻し）。
- 地図コンポーネントは SSR 不可のため `dynamic(() => import(...), { ssr: false })` で読み込む。

### 5.4 テスト

- `src/lib/` 配下の純粋ロジック（Zod スキーマ、OCR 出力の正規化、統計集計）は Vitest で単体テスト必須。
- E2E は「ログイン → 手入力で記録作成 → 入力記録一覧に表示」の 1 本を最低限維持する（`tests/e2e/create-log.spec.ts`）。
- OCR プロバイダのテストは実 API を叩かず、`tests/fixtures/cards/` のサンプル画像と録画済みレスポンスを使う。
- Supabase を触るロジックは、`SupabaseClient` を引数に取る純粋な関数（`features/logs/create-log.ts`、`delete-log.ts`、`features/account/` など）に切り出し、`tests/unit/features/fake-client.ts` の偽クライアント（insert / select / update / delete の結果を順に消費し、呼び出し順を記録する）で検証する。React Query のフック（`useXxx`）は薄い包み紙にして直接テストしない。

## 6. 開発コマンド

```bash
pnpm install
pnpm dev                 # http://localhost:3100（ポートは 3100 に固定。3000 は他プロジェクトが使用）
pnpm lint && pnpm typecheck
pnpm test                                   # Vitest 全部
pnpm vitest run tests/unit/rating.test.ts   # ファイル 1 つ
pnpm vitest run -t '0.5 刻み'               # テスト名で絞る
# 単体テストの既定環境は jsdom。Node 専用のテストは先頭に `// @vitest-environment node` を書く（env.test.ts が例）
pnpm test:e2e            # Playwright。3100 で dev サーバーを自分で起動する（起動済みなら再利用）
pnpm build               # dev サーバー（3100）が動いている間は実行しない（.next を上書きして dev が壊れる）
pnpm format              # Prettier（Markdown と docs/design は対象外）
pnpm db:types            # クラウド（ref gayhfwmvlxwyuzrvmkoy）から src/types/database.ts を再生成
vercel deploy --prod     # 本番デプロイを手動で走らせる（通常は main への push で自動デプロイ）
pnpm seed:dev -- --email <ログインに使ったアドレス> --reset   # サンプルデータ投入（.env.local に SUPABASE_SERVICE_ROLE_KEY）
ANTHROPIC_API_KEY=sk-ant-… pnpm vitest run tests/unit/ocr/live.test.ts   # OCR を実 API で確認し応答を録画
pnpm exec supabase db query --linked --project-ref gayhfwmvlxwyuzrvmkoy -f supabase/migrations/NNNN_x.sql   # 本番にマイグレーション適用
```

Docker が無いので `pnpm supabase start` / `db:migrate` / `db:types:local` は使えない。スキーマ変更は `supabase/migrations/` に SQL を書き、上の `supabase db query --linked` で本番に適用（SQL Editor に貼っても可）してから `pnpm db:types` を実行する。

品質ゲート: コミット前フック（simple-git-hooks + lint-staged）が staged ファイルに `eslint --max-warnings=0`（**警告 1 つでもコミット失敗**）と `prettier --check`、続けて `pnpm typecheck` を走らせる（緊急時は `--no-verify`）。GitHub Actions の `ci.yml` は `main` への push と PR で lint / typecheck / 単体テストを回す（E2E と build は CI では走らない）。単体テストは `tests/unit/**/*.test.{ts,tsx}` だけを拾い、`@/` は `src/` に解決される。E2E は `.env.local` の `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` が無いとログインが要るテストを skip し、`SUPABASE_SERVICE_ROLE_KEY` があれば `global-setup.ts` がテストユーザーを自動作成する。`E2E_BASE_URL` で本番など別 URL に向けられる。

環境変数は `.env.example` を正とし、新しい変数を追加したら必ずそこにも追記する。

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=         # ローカル http://localhost:3100 / 本番 https://coffee-notes.app（絶対 URL）
SUPABASE_SERVICE_ROLE_KEY=        # サーバーのみ
OCR_PROVIDER=claude|none          # none はOCRを無効化（開発時の費用節約）
ANTHROPIC_API_KEY=                # サーバーのみ
GEO_PROVIDER=nominatim|google
GOOGLE_MAPS_API_KEY=              # GEO_PROVIDER=google のとき
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=   # ローカル Supabase の config.toml から env() で参照
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=
CRON_SECRET=                      # サーバーのみ。/api/ocr/warm を叩く GitHub Actions の Secrets と同じ値
E2E_TEST_EMAIL=                   # Playwright 用。無ければログインが要る E2E は skip
E2E_TEST_PASSWORD=
```

## 7. Claude Code への作業ルール

1. **着手前に REQUIREMENTS.md の該当 ID（F-XXX-n）を確認し、優先度が Later のものは実装しない。**
2. 未確定項目（§2.1）に触れる実装は、選択肢と推奨を示してユーザーの判断を待つ。仮実装で先へ進めない。
3. 既存の動いている機能を壊さない。リファクタ時は変更前後で `pnpm test` と E2E を通す。
4. 1 つの PR / 作業単位は 1 機能 ID に対応させる。複数 ID をまとめて変更しない。
5. スキーマ変更・RLS 変更・外部 API 追加・環境変数追加は、作業報告の冒頭で明示する。
6. 決定事項（技術選定、方式変更）は `docs/decisions/NNNN-title.md` に ADR として残す（背景 / 選択肢 / 決定 / 理由 の 4 節）。
7. 作業報告は「分かったこと」と「やったこと／次にやること」を分けて書き、最後に該当フェーズの進捗率を書く。
8. 外部サービスの料金・仕様に依存する判断は、確認した日付と出典を ADR に添える。
9. 秘密情報（API キー、Supabase の service role キー）をコード・ログ・テストフィクスチャに含めない。ユーザーから鍵を受け取るときは会話に貼らせず、`~/.coffeenotes-secrets/<name>.txt` に置いてもらい、ファイル経由で使って終わったら削除する（手順は `docs/USER-SETUP.md`）。
10. コミットは Conventional Commits（`feat:` `fix:` `chore:` `docs:`）。日本語の本文可。

## 8. 現在の状態と次のタスク

- [x] Phase 0: ディレクトリ骨組み（§3）・git 初期化・CI ワークフロー・PR テンプレート（2026-09-21）
- [x] Phase 0: GitHub リモート作成と push（https://github.com/ohagi-0/coffeenotes、2026-09-21）
- [x] Phase 0: リポジトリ初期化（Next.js 15 + Tailwind v4 + shadcn/ui + Supabase クライアント、Vitest / Playwright / Prettier 設定）（2026-09-21）
- [x] Phase 0: `supabase/migrations/0001_init.sql`（REQUIREMENTS.md §4 のテーブル + RLS + Storage ポリシー）（2026-09-21）
- [x] Phase 0: 認証（メールリンク + Google のログイン画面・コールバック）と `(app)` レイアウトの下タブ（2026-09-21）
- [x] Phase 0: `docs/decisions/` に ADR 0001〜0005 を作成（2026-09-21）
- [x] Q1〜Q5 の決定（REQUIREMENTS.md §8.3、2026-09-21）
- [x] 画面設計: モック `docs/design/`・基本設計書 `docs/DESIGN.md`・ADR 0006（ダーク専用・銅アクセント・Bodoni Moda + Manrope）（2026-09-21）
- [x] 画面設計: Web PC 版（3 列、D1〜D4）と iOS アプリ版（I1〜I7）を追加、ADR 0007。モックを 4 ページに分割（2026-09-22）
- [x] 画面設計: Web スマホ版を Web サイトの作法（ヘッダー + ドロワー、フッター、下タブ無し）に変更。下タブは iOS 版のみ（2026-09-22）
- [x] Phase 0: Supabase プロジェクト作成（`ohagi-0's coffee`、ref `gayhfwmvlxwyuzrvmkoy`、ap-northeast-1）、`0001_init.sql` を SQL Editor で適用、`.env.local` 設定、`src/types/database.ts` 生成（2026-09-21）
- [ ] Phase 0: ローカル Supabase 用に Docker Desktop を導入（任意。クラウドだけで進めることも可）
- [x] Phase 0: PC でメールリンクのログイン → 空のホーム表示を確認（2026-09-21）。**Phase 0 の完了条件を達成**
- [x] Vercel にデプロイ（プロジェクト `coffeenotes`、本番 https://coffeenotes-red.vercel.app。CLI から `vercel deploy --prod`）（2026-09-21）。GitHub 連携は初回デプロイ時に CLI が自動で紐づけており、`main` への push で本番デプロイが走ることを確認（2026-09-24）
- [x] Supabase Auth の URL 設定（Site URL = 本番、Redirect URLs に localhost:3100 / 127.0.0.1:3100 / 本番 / `coffeelog://` の 4 つ）（2026-09-21）
- [x] スマホで本番 URL からログイン確認（2026-09-24）
- [x] Google ログインを有効化（Google Cloud プロジェクト `coffeenotes` で同意画面 + Web クライアント作成 → Supabase Providers で Google 有効化。承認済みドメインは `coffee-notes.app` と `gayhfwmvlxwyuzrvmkoy.supabase.co`）— F-AUTH-1 の Must（2026-09-24）
- [x] Q6（URL の形）をクエリ文字列に決定。ADR 0008、`src/lib/routes.ts`（2026-09-22）
- [x] Phase 1: 非 UI — #4 Zod スキーマ、#5 豆・ロースター・店・タグのデータ層、#6 記録のデータ層（2026-09-22）
- [x] Phase 1: 非 UI — #8 画像圧縮・Storage 保存・platform ラッパー（`src/lib/image/compress.ts`、`src/lib/storage/bean-images.ts`、`src/lib/platform/{camera,geolocation,share}.ts`。F-OCR-1 / F-BEAN-12 / F-SHOP-3、N-4 / N-5）（2026-09-22）
- [x] Phase 1: 非 UI — #7 開発用シードデータ投入（`scripts/seed-dev.mjs` + `pnpm seed:dev -- --email <アドレス> --reset`。記録 15 / 豆 6 / 店 4 / 焙煎 1 / タグ 5。行の ID はユーザー ID を名前空間にした UUID v5 なので再実行しても増えない。`SUPABASE_SERVICE_ROLE_KEY` が要る）（2026-09-22）。**実行はユーザー作業**: キーを `.env.local` に入れて 1 回流す
- [x] Phase 1: UI（Issues #9〜#24）すべて完了（2026-09-22）。E2E の主要フロー（#24）は `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` を設定すると実行される。詳細は `docs/worklog/ui-progress.md`
- [x] 公開準備: 独自ドメイン coffee-notes.app を取得し本番に設定（Vercel・Supabase Auth・config.toml）（2026-09-22）
- [x] 公開準備: カスタム SMTP — Resend（ap-northeast-1、coffee-notes.app を DKIM/SPF 検証済み）を Supabase の SMTP に設定。送信元 `coffeenotes <login@coffee-notes.app>`、上限 30 通/時。ログインメールは日本語化し `{{ .RedirectTo }}?token_hash=…` 形式（送信時と別のブラウザで開いても通る）（2026-09-22）
- [x] Phase 1 を本番 https://coffee-notes.app にデプロイ（UI-7〜16 + データ層 + SMTP）。品質ゲート（typecheck / lint / unit 229 / E2E 7 / build）通過（2026-09-22）
- [x] Phase 1: 実機（スマホ）で本番からログイン → 手入力で記録作成 → 一覧表示を確認して Phase 1 完了（2026-09-24）
- [x] Phase 2: カード読み取り — マイグレーション 0002（`ocr_usage` + `consume_ocr_quota()`）、`providers/claude.ts`、`/api/ocr`、S3 ①撮影 / ②読み取り確認（要確認タグ、10 秒で手入力へ、失敗・上限・無効の 3 状態）、保存時に Storage へ画像と `bean_images` 行、豆詳細・一覧・記録詳細で署名付き URL を表示、設定に今日の回数（2026-09-22）
- [x] Phase 2: `ANTHROPIC_API_KEY` と `OCR_PROVIDER=claude` を Vercel（Production / Preview）に設定し、実 API で `tests/unit/ocr/live.test.ts` を通して応答を録画（`recorded: true`、合成カードで 4.5 秒・入力 4,740 トークン）（2026-09-24）
- [x] Phase 2: OCR の初回遅延対策 — タイムアウト 30 秒、`/api/ocr/warm` + `ocr-warmup.yml`（12 時間ごと）、`CRON_SECRET` を Vercel と GitHub に設定（2026-09-24）
- [x] Phase 2: 実機で撮影 → 読み取り → 保存が 1 分以内に終わることを確認（2026-09-24）。**Phase 2 の完了条件を達成**
- [x] F-AUTH-3 アカウント削除（0003_delete_my_account.sql、設定画面の確認ブロック）と /privacy /terms（2026-09-22）
- [x] 公開準備（ユーザー作業）: Google Cloud で OAuth クライアント作成 → Supabase Providers で Google 有効化 → 同意画面を本番公開（2026-09-24）
- [x] Phase 3 地図: /map（Leaflet + OSM、平均星で色分けしたピン、現在地、長押しで店登録）、/api/geo（Overpass / Nominatim）、記録作成③と店フォームの「現在地から探す / 店名で検索 / 地図で指定」（2026-09-22）
- [x] Phase 4 自宅抽出・焙煎: レシピの折りたたみ、比率の自動計算、前回のレシピを複製、焙煎バッチ（一覧・登録・記録への紐づけ・バッチ別平均星）（2026-09-22）
- [x] Phase 5 分析・仕上げ: /stats（4 タイル、高評価の生産国・精製、フレーバー、味覚レーダー、月別）、PWA（serwist、オフライン閲覧、アイコン）、CSV / JSON エクスポート、カードの QR → 参照 URL（2026-09-22）
- [x] Phase 5 の実機確認: ホーム画面に追加 → 機内モードで一覧・豆詳細が開く、エクスポートのダウンロード（2026-09-24）
- [ ] Phase 6 ネイティブ化（Capacitor）— 未着手。前提の制約（§2.2）は守られている

進捗はこのチェックリストを更新して管理する。

- ブラウザ API（カメラ、位置情報、共有）に触れてよいのは `src/lib/platform/` の 5 ファイル（camera / geolocation / share / network / download）だけ。UI から `navigator.*` を直接呼ばない（N-4）。違反は `grep -rn 'navigator\.' src --include='*.ts' --include='*.tsx' | grep -v '^src/lib/platform/'` が空になることで確認する。
- 画像圧縮は Canvas 系 API を使うため jsdom では検証できない。寸法計算 `fitWithin` を純粋関数として単体テストし、実ブラウザでの挙動は `tests/e2e/image-compress.spec.ts` で確認する（compress.ts の関数を `toString()` でページに流し込んで実行する）。
- `uploadBeanImage` は Storage への保存だけを行い、`bean_images` 行の作成は features 層の責務にしている。バケットは非公開なので表示は `getBeanImageUrl` の署名付き URL を使う。

### 8.1 実装・運用上のメモ（フェーズをまたいで効く細部）

- 認証ガードはミドルウェアではなく `(app)/layout.tsx` でクライアント側判定する（静的出力・Capacitor 対応のため）。`src/lib/supabase/middleware.ts` は作らない。
- `next.config.ts` に `output: 'export'` は付けていない（`/api/*` を同居させるため。ADR 0002）。
- shadcn/ui は Base UI ベース（`@base-ui/react`）。`Button` に `asChild` は無く、リンク化は `render={<Link href="…" />}` を使う。
- Supabase クライアントはシングルトンを遅延生成する（`getSupabaseBrowserClient()`）。モジュール直下で生成するとビルド時のプリレンダーで env 検証に失敗する。
- `pnpm db:types` はクラウドのプロジェクト（`--project-id gayhfwmvlxwyuzrvmkoy`）から生成する。Docker でローカル Supabase を動かす場合は `pnpm db:types:local`。
- 0001 は SQL Editor で手動適用したため `supabase_migrations` に記録が無い。`supabase link` して `db push` を使い始めるときは、先に `supabase migration repair --status applied 0001` で整合を取る。
- Prettier は Markdown と `docs/design/` を対象外（`.prettierignore`）。要件定義書・ADR の表と画面設計モックを手書きのまま保つため。
- **dev サーバー（3100）が動いている間に `pnpm build` をしない。** 両方が `.next/` を使うため、build が dev の開発用チャンクを消して全ページの JS が 404 になる（2026-09-22 に発生）。build が要るときは dev を止めるか、`vercel deploy --prod` に任せる。
- コミット前フック（simple-git-hooks + lint-staged）で staged ファイルの ESLint / Prettier チェックと `pnpm typecheck` が走る。緊急時は `git commit --no-verify`。
- クラウド Supabase の Auth 設定は Management API で変更できる（トークンは macOS キーチェーンの `Supabase CLI`）。`GET/PATCH https://api.supabase.com/v1/projects/gayhfwmvlxwyuzrvmkoy/config/auth`。
- マジックリンクの戻り先は要求元の `NEXT_PUBLIC_API_BASE_URL` で決まる。ローカルで要求したリンクをスマホで開いても `localhost` には繋がらない。スマホで試すときは本番 URL から要求する。
- メール送信は Resend の SMTP 経由。Resend の API キーは Supabase の SMTP パスワードとして保存されているので、**Resend 側でそのキーを削除するとログインメールが止まる**。差し替えるときは新キーを作ってから Supabase の SMTP 設定を更新する。Cloudflare の DNS レコード（`resend._domainkey`、`send`、`rsend`）も消さない。
- Supabase Free では、カスタム SMTP を設定して初めてメール文面を変更できる（内蔵メールのままだと Management API が 400 を返す）。
- マイグレーションは `pnpm exec supabase db query --linked --project-ref gayhfwmvlxwyuzrvmkoy -f supabase/migrations/NNNN.sql` で本番に適用できる（CLI のトークンを使うのでキーチェーン不要）。0001 / 0002 はこの方法か SQL Editor で適用済みで、`supabase_migrations` には記録が無い。
- 記録作成ウィザードの段階間の受け渡しは sessionStorage。撮影画像は data URL（`src/features/ocr/capture-draft.ts`）、豆の下書きは `new-log-draft.ts`。Blob は JSON にできないため。保存時に `dataUrlToBlob` で戻して Storage に上げる。
- **PWA / オフライン**: `src/app/sw.ts`（serwist）。Supabase REST の GET は NetworkFirst、署名付き画像と地図タイルは StaleWhileRevalidate。書き込みと `/api/*` はキャッシュしない。ログアウトと退会で `clearOfflineCaches()` がデータのキャッシュを消す。開発中は SW 無効。`public/sw.js` は生成物（.gitignore 済み）。
- **生産国・品種の語彙**（2026-09-24、ADR 0009）: `src/lib/vocab/` の `COUNTRY_SHELVES`（生産量順、FAO 2023）/ `VARIETY_SHELVES`（店で見る頻度順）が別名表と棚の順を兼ねる。`countryDisplayName` / `varietyDisplayName` で日本語の呼び名に寄せ、コレクションの棚・入力記録一覧の生産国チップ・好みの分析・豆フォームの候補（`suggestCountries` / `suggestVarieties`）・OCR の流し込みが全部これを使う。値は入力どおり保存し、寄せるのは表示と絞り込みだけ。順や別名を変えるときは配列を直すだけでよい。
- **記録削除と店**（F-LOG-7、2026-09-24）: `features/logs/delete-log.ts` が記録を消したあと、その店の記録が 0 件なら店も消す。先に店だけ登録した場合は残る。
- **統計**: `features/stats/aggregate.ts` の純粋関数で集計（高評価 = 星 4 以上、豆ごとに 1 回数える項目とレコードごとに数える項目がある）。データは `useStatsRows()` が必要な列だけ全件取る。
- **エクスポート**: `features/export/build.ts`（CSV は BOM + CRLF、JSON は記録の配列）。ダウンロードは `lib/platform/download.ts`。
- Supabase Free の一時停止対策として `.github/workflows/supabase-keepalive.yml` が週 2 回 REST を叩く（Secrets: `SUPABASE_URL` / `SUPABASE_ANON_KEY`）。
- OCR の初回遅延対策として `.github/workflows/ocr-warmup.yml` が 12 時間ごとに `POST https://coffee-notes.app/api/ocr/warm` を叩く（Secrets: `CRON_SECRET`。Vercel の同名変数と同じ値。差し替えるときは両方を更新する）。費用は 1 回 1 円未満。
- 画面設計は `docs/DESIGN.md` を正とする（トークン、書体、部品仕様、画面ごとの要素・状態・遷移）。見た目の参照はモック `docs/design/`（index = 方針・色・書体・部品、mobile = Web スマホ、desktop = Web PC、ios = iOS アプリ。共通の design.css / design.js。GitHub Pages で https://ohagi-0.github.io/coffeenotes/design/ に公開、push で更新）。リポジトリは Pages のため public（2026-09-21）。画面や部品を変えるときはモックと DESIGN.md を同じ PR で更新する。
