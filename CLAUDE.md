# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

コーヒー記録アプリ **coffeenotes**。このファイルは Claude Code がこのリポジトリで作業するときの前提・ルールをまとめたもの。
要件の詳細は `docs/REQUIREMENTS.md` を正とする。矛盾があれば REQUIREMENTS.md を優先し、このファイルを直す。

## 1. プロジェクト概要

飲んだコーヒー豆をテイスティングカードの写真から半自動で記録し、店・星評価・タグと紐づけて一覧/検索/地図/統計で振り返る **スマホ向け PWA**。店で飲んだ記録も、自宅で挽いて淹れた記録（レシピ付き）も、自家焙煎した豆の記録も同じ軽さで残せる。複数ユーザーが各自のプライベートな記録帳として使う。**将来 Capacitor で iOS/Android アプリとして配信する**（REQUIREMENTS.md §13）。

- 開発者: 個人（Kota）。レビュー相手は Claude Code。
- 規模目標: 個人〜数十ユーザー。ランニングコストは月 0〜数百円。
- 現在のフェーズ: **Phase 1（手入力 MVP）**。Phase 0 は 2026-09-21 完了。フェーズ定義は REQUIREMENTS.md §10。
- 作業の分担: UI は GitHub Issues の `ui` ラベル（#9〜#24、UI-1〜UI-16。着手順は番号順）、それ以外は `non-ui` ラベル（#4〜#8）で管理。UI と非 UI は別の Claude Code ウィンドウが担当。UI の Issue は「見た目（props 駆動）→ データ接続」の 2 段階に分けてあり、段階 1 は非 UI の完了を待たずに進める。 **UI 側の進捗と触ったパスは `docs/worklog/ui-progress.md` に記録する。非 UI 側は作業前にそれを読み、書かれたパスを触らない。****同じワーキングツリーを共有している**ので §3.1 の注意を守る。

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
| ホスティング | Vercel Hobby | 本番 **https://coffee-notes.app**（Cloudflare Registrar で取得、DNS は Cloudflare、プロキシ OFF）。旧 URL https://coffeenotes-red.vercel.app は本体へ転送。プロジェクト `coffeenotes`。デプロイは `vercel deploy --prod`。**GitHub 連携は未接続**なので push しても自動デプロイされない |

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
│   └── decisions/             # ADR: 決めたことを 1 ファイル 1 決定で残す
├── src/
│   ├── app/                   # App Router（route ごとにフォルダ）
│   │   ├── (auth)/login/
│   │   ├── (app)/             # ログイン後。layout に認証ガード + ナビ（Web はサイトヘッダー + ドロワー。現状の bottom-nav.tsx は Phase 0 の暫定で、DESIGN.md §3 に置き換える）
│   │   │   ├── page.tsx       # ホーム（タイムライン）
│   │   │   ├── logs/new/      # 記録作成ウィザード
│   │   │   ├── logs/              # 記録詳細・編集 `/logs?id=…`（ADR 0008。[id] は使わない）
│   │   │   ├── beans/             # 豆詳細 `/beans?id=…`
│   │   │   ├── shops/             # 一覧。詳細は shops/detail/ `/shops/detail?id=…`
│   │   │   ├── map/
│   │   │   ├── stats/
│   │   │   └── settings/
│   │   └── api/
│   │       ├── ocr/route.ts   # OCR 実行（API キーはここでのみ使う）
│   │       └── geo/route.ts   # 店候補・ジオコーディング
│   ├── components/
│   │   ├── ui/                # shadcn/ui 生成物（手で編集しない）
│   │   ├── beans/  logs/  shops/  map/  stats/
│   ├── features/              # ドメインごとのロジック（hooks, queries, mutations）
│   │   ├── beans/  logs/  shops/  roasts/  tags/  stats/
│   ├── lib/
│   │   ├── supabase/          # client.ts（ブラウザ、シングルトン）/ server.ts（Route Handler 用）。middleware.ts は作らない
│   │   ├── ocr/               # index.ts(インターフェース) + providers/
│   │   ├── geo/               # index.ts(インターフェース) + providers/
│   │   ├── image/             # ブラウザ側圧縮・リサイズ
│   │   ├── storage/           # Supabase Storage（カード画像の保存・署名付き URL）
│   │   ├── platform/          # camera.ts / geolocation.ts / share.ts（Web と Capacitor の差を吸収）
│   │   └── schemas/           # Zod スキーマ（DB 型と対応）
│   └── types/
│       └── database.ts        # `supabase gen types` の生成物（手で編集しない）
├── supabase/
│   ├── migrations/            # SQL。RLS ポリシーも必ずここに書く
│   ├── seed.sql
│   └── config.toml
├── public/                    # manifest.json, icons
├── scripts/               # 開発用スクリプト（#7 のシード投入など。ビルド不要の .mjs）
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
  extractBeanCard(images: { front: Blob; back?: Blob }): Promise<BeanCardExtraction>;
}
// BeanCardExtraction は Zod スキーマ (src/lib/schemas/bean-card.ts) で定義。
// 各項目は { value, confidence } の形で返し、UI で低信頼度を強調できるようにする。
```

- プロバイダは `src/lib/ocr/providers/claude.ts` を実装する（`OCR_PROVIDER=claude`）。他方式は将来の差し替え用にディレクトリだけ想定しておく。
- Claude 実装の要点: モデル `claude-haiku-4-5`、表・裏を 1 リクエスト、`tool_use` で Zod スキーマ相当の JSON を強制、`max_tokens` 1,024、タイムアウト 15 秒。1 ユーザー 1 日 50 回のレート制限を `/api/ocr` に入れる。
- **アプリ本体は `OcrProvider` 以外を import しない**。
- 低信頼度の判定は `LOW_CONFIDENCE_THRESHOLD`（`src/lib/schemas/bean-card.ts`、現在 0.6）を使い、UI や設計書に数値を直書きしない。
- OCR 失敗時は例外を握りつぶさず、UI は「手入力に切り替える」導線を出す。
- `beans.ocr_raw` にプロバイダの生出力を保存する（再抽出・方式比較用）。
- geo も同じ構造（`GeoProvider.searchNearby` / `geocode`）。

### 5.3 UI

- 色・書体・部品・画面仕様は `docs/DESIGN.md` に従う（ダーク専用、銅は操作要素だけ、豆名は Bodoni Moda、数字は Manrope、日本語は端末フォント）。
- ナビは Web ではサイトヘッダー（ワードマーク、「＋ 記録する」、メニュー）+ 右からのドロワー + フッター。下タブは iOS アプリ版だけ（ADR 0007 追記）。ナビとページ名は略称を使わず「入力記録一覧 / 記録したお店 / 記録したお店のマップ / 好みの分析 / 設定」で統一する（DESIGN.md §3）。
- モバイルファースト。ボタン・タップ領域は 44px 以上。
- フォームは react-hook-form + Zod resolver。OCR 結果はフォームの `defaultValues` に流し込むだけにし、確定は必ずユーザー操作。
- 画像は保存前に `src/lib/image/compress.ts` で長辺 1,600px・JPEG 品質 0.8 に圧縮する。
- ローディング・空状態・エラー状態を必ず実装する（3 状態が無いコンポーネントはレビューで差し戻し）。
- 地図コンポーネントは SSR 不可のため `dynamic(() => import(...), { ssr: false })` で読み込む。

### 5.4 テスト

- `src/lib/` 配下の純粋ロジック（Zod スキーマ、OCR 出力の正規化、統計集計）は Vitest で単体テスト必須。
- E2E は「ログイン → 手入力で記録作成 → タイムラインに表示」の 1 本を最低限維持する。
- OCR プロバイダのテストは実 API を叩かず、`tests/fixtures/cards/` のサンプル画像と録画済みレスポンスを使う。

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
pnpm build
pnpm format              # Prettier（Markdown と docs/design は対象外）
pnpm db:types            # クラウド（ref gayhfwmvlxwyuzrvmkoy）から src/types/database.ts を再生成
vercel deploy --prod     # 本番デプロイ（GitHub 連携が無いので手動）
```

Docker が無いので `pnpm supabase start` / `db:migrate` / `db:types:local` は使えない。スキーマ変更は `supabase/migrations/` に SQL を書き、ダッシュボードの SQL Editor に貼って適用してから `pnpm db:types` を実行する。コミット前フックが lint / Prettier チェック / typecheck を走らせる（緊急時は `--no-verify`）。

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
9. 秘密情報（API キー、Supabase の service role キー）をコード・ログ・テストフィクスチャに含めない。
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
- [x] Vercel にデプロイ（プロジェクト `coffeenotes`、本番 https://coffeenotes-red.vercel.app。CLI から `vercel deploy --prod`。GitHub 連携は未接続で、ブラウザで Vercel と GitHub を接続すれば push で自動デプロイになる）（2026-09-21）
- [x] Supabase Auth の URL 設定（Site URL = 本番、Redirect URLs に localhost:3100 / 127.0.0.1:3100 / 本番 / `coffeelog://` の 4 つ）（2026-09-21）
- [ ] スマホで本番 URL からログイン確認
- [ ] Google ログインを有効化（Google Cloud で OAuth クライアント作成 → Supabase の Providers で設定）— F-AUTH-1 の Must
- [x] Q6（URL の形）をクエリ文字列に決定。ADR 0008、`src/lib/routes.ts`（2026-09-22）
- [x] Phase 1: 非 UI — #4 Zod スキーマ、#5 豆・ロースター・店・タグのデータ層、#6 記録のデータ層（2026-09-22）
- [x] Phase 1: 非 UI — #8 画像圧縮・Storage 保存・platform ラッパー（`src/lib/image/compress.ts`、`src/lib/storage/bean-images.ts`、`src/lib/platform/{camera,geolocation,share}.ts`。F-OCR-1 / F-BEAN-12 / F-SHOP-3、N-4 / N-5）（2026-09-22）
- [x] Phase 1: 非 UI — #7 開発用シードデータ投入（`scripts/seed-dev.mjs` + `pnpm seed:dev -- --email <アドレス> --reset`。記録 15 / 豆 6 / 店 4 / 焙煎 1 / タグ 5。行の ID はユーザー ID を名前空間にした UUID v5 なので再実行しても増えない。`SUPABASE_SERVICE_ROLE_KEY` が要る）（2026-09-22）。**実行はユーザー作業**: キーを `.env.local` に入れて 1 回流す
- [x] Phase 1: UI（Issues #9〜#24）すべて完了（2026-09-22）。E2E の主要フロー（#24）は `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` を設定すると実行される。詳細は `docs/worklog/ui-progress.md`
- [x] 公開準備: 独自ドメイン coffee-notes.app を取得し本番に設定（Vercel・Supabase Auth・config.toml）（2026-09-22）
- [x] 公開準備: カスタム SMTP — Resend（ap-northeast-1、coffee-notes.app を DKIM/SPF 検証済み）を Supabase の SMTP に設定。送信元 `coffeenotes <login@coffee-notes.app>`、上限 30 通/時。ログインメールは日本語化し `{{ .RedirectTo }}?token_hash=…` 形式（送信時と別のブラウザで開いても通る）（2026-09-22）
- [x] Phase 1 を本番 https://coffee-notes.app にデプロイ（UI-7〜16 + データ層 + SMTP）。品質ゲート（typecheck / lint / unit 229 / E2E 7 / build）通過（2026-09-22）
- [ ] Phase 1: 実機（スマホ）で本番からログイン → 手入力で記録作成 → 一覧表示を確認して Phase 1 完了
- [ ] 公開準備（未着手）: Google 同意画面の本番公開、プライバシーポリシー、アカウント削除（F-AUTH-3）の繰り上げ

進捗はこのチェックリストを更新して管理する。

- ブラウザ API（カメラ、位置情報、共有）に触れてよいのは `src/lib/platform/` の 3 ファイルだけ。UI から `navigator.*` を直接呼ばない（N-4）。違反は `grep -rn 'navigator\.' src --include='*.ts' --include='*.tsx' | grep -v '^src/lib/platform/'` が空になることで確認する。
- 画像圧縮は Canvas 系 API を使うため jsdom では検証できない。寸法計算 `fitWithin` を純粋関数として単体テストし、実ブラウザでの挙動は `tests/e2e/image-compress.spec.ts` で確認する（compress.ts の関数を `toString()` でページに流し込んで実行する）。
- `uploadBeanImage` は Storage への保存だけを行い、`bean_images` 行の作成は features 層の責務にしている。バケットは非公開なので表示は `getBeanImageUrl` の署名付き URL を使う。

### 8.1 実装上のメモ（Phase 0 で決めた細部）

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
- Supabase Free の一時停止対策として `.github/workflows/supabase-keepalive.yml` が週 2 回 REST を叩く（Secrets: `SUPABASE_URL` / `SUPABASE_ANON_KEY`）。
- 画面設計は `docs/DESIGN.md` を正とする（トークン、書体、部品仕様、画面ごとの要素・状態・遷移）。見た目の参照はモック `docs/design/`（index = 方針・色・書体・部品、mobile = Web スマホ、desktop = Web PC、ios = iOS アプリ。共通の design.css / design.js。GitHub Pages で https://ohagi-0.github.io/coffeenotes/design/ に公開、push で更新）。リポジトリは Pages のため public（2026-09-21）。画面や部品を変えるときはモックと DESIGN.md を同じ PR で更新する。
