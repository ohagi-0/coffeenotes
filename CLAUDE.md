# CLAUDE.md — コーヒー記録アプリ

このファイルは Claude Code がこのリポジトリで作業するときの前提・ルールをまとめたもの。
要件の詳細は `docs/REQUIREMENTS.md` を正とする。矛盾があれば REQUIREMENTS.md を優先し、このファイルを直す。

## 1. プロジェクト概要

飲んだコーヒー豆をテイスティングカードの写真から半自動で記録し、店・星評価・タグと紐づけて一覧/検索/地図/統計で振り返る **スマホ向け PWA**。店で飲んだ記録も、自宅で挽いて淹れた記録（レシピ付き）も、自家焙煎した豆の記録も同じ軽さで残せる。複数ユーザーが各自のプライベートな記録帳として使う。**将来 Capacitor で iOS/Android アプリとして配信する**（REQUIREMENTS.md §13）。

- 開発者: 個人（Kota）。レビュー相手は Claude Code。
- 規模目標: 個人〜数十ユーザー。ランニングコストは月 0〜数百円。
- 現在のフェーズ: **Phase 0（基盤）**。フェーズ定義は REQUIREMENTS.md §10。

## 2. 技術スタック（確定分）

| レイヤ | 採用 | 備考 |
|---|---|---|
| フレームワーク | Next.js 15 系 App Router + TypeScript（strict） | `src/` 構成。**静的出力（`output: 'export'`）可能な範囲で書く**（§2.2） |
| OCR | Claude Haiku 4.5 Vision（Anthropic SDK） | `src/lib/ocr/providers/claude.ts`。`/api/ocr` からのみ呼ぶ |
| UI | Tailwind CSS + shadcn/ui | スマホ幅（375px）を基準にデザイン |
| PWA | serwist | オフライン時は閲覧のみ |
| BaaS | Supabase（Postgres / Auth / Storage） | RLS 必須。`supabase/migrations` で管理 |
| データ取得 | Supabase JS v2 + TanStack Query | サーバーコンポーネントでは `@supabase/ssr` |
| バリデーション | Zod | フォーム・API・OCR 出力すべてに適用 |
| 地図 | react-leaflet + OpenStreetMap タイル | API キー不要 |
| QR | @zxing/browser | ブラウザ内で完結 |
| テスト | Vitest（単体）+ Playwright（E2E、主要フローのみ） | |
| Lint / Format | ESLint（next/core-web-vitals）+ Prettier | コミット前に `pnpm lint && pnpm typecheck` |
| パッケージ管理 | pnpm | `npm` / `yarn` を混ぜない |
| ホスティング | Vercel Hobby | |

### 2.1 決定済み事項（2026-09-21）— 勝手に変えない

| 項目 | 決定 | 実装上の扱い |
|---|---|---|
| OCR エンジン | Claude Haiku 4.5 Vision | `OcrProvider` 抽象化は維持（§5.2） |
| 店候補・ジオコーディング | まず Nominatim。**店名・住所の手入力と地図タップでの位置指定は Must** | `GeoProvider` 抽象化。候補検索は入力補助であり、失敗しても手入力で店を作れること |
| ログイン方式 | メールリンク + Google の両方 | Supabase Auth で両プロバイダ有効化。同一メールは同一アカウント |
| 星の刻み | 0.5 刻み（1.0〜5.0） | DB `numeric(2,1)`。UI は星の左右半分タップ |
| ロースター名 | 全ユーザー共通マスタ | `roasters` は RLS で読み取り全員可・INSERT は認証ユーザー可・UPDATE/DELETE は作成者のみ |
| 配信形態 | PWA 先行、後に Capacitor | §2.2 |

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
│   │   ├── (app)/             # ログイン後。layout に下タブナビ
│   │   │   ├── page.tsx       # ホーム（タイムライン）
│   │   │   ├── logs/new/      # 記録作成ウィザード
│   │   │   ├── logs/[id]/
│   │   │   ├── beans/[id]/
│   │   │   ├── shops/
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
│   │   ├── supabase/          # client.ts / server.ts / middleware.ts
│   │   ├── ocr/               # index.ts(インターフェース) + providers/
│   │   ├── geo/               # index.ts(インターフェース) + providers/
│   │   ├── image/             # ブラウザ側圧縮・リサイズ
│   │   ├── platform/          # camera.ts / geolocation.ts / share.ts（Web と Capacitor の差を吸収）
│   │   └── schemas/           # Zod スキーマ（DB 型と対応）
│   └── types/
│       └── database.ts        # `supabase gen types` の生成物（手で編集しない）
├── supabase/
│   ├── migrations/            # SQL。RLS ポリシーも必ずここに書く
│   ├── seed.sql
│   └── config.toml
├── public/                    # manifest.json, icons
└── tests/
    ├── unit/
    └── e2e/
```

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
- OCR 失敗時は例外を握りつぶさず、UI は「手入力に切り替える」導線を出す。
- `beans.ocr_raw` にプロバイダの生出力を保存する（再抽出・方式比較用）。
- geo も同じ構造（`GeoProvider.searchNearby` / `geocode`）。

### 5.3 UI

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
pnpm supabase start      # ローカル Supabase（Docker）
pnpm db:migrate          # supabase db push（ローカル）
pnpm db:types            # src/types/database.ts を再生成
pnpm lint && pnpm typecheck
pnpm test                # Vitest
pnpm test:e2e            # Playwright
pnpm build
```

環境変数は `.env.example` を正とし、新しい変数を追加したら必ずそこにも追記する。

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE_URL=         # 例: https://coffeelog.vercel.app（ネイティブ化のため絶対URL）
SUPABASE_SERVICE_ROLE_KEY=        # サーバーのみ
OCR_PROVIDER=claude|none          # none はOCRを無効化（開発時の費用節約）
ANTHROPIC_API_KEY=                # サーバーのみ
GEO_PROVIDER=nominatim|google
GOOGLE_MAPS_API_KEY=              # GEO_PROVIDER=google のとき
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
- [x] Phase 0: Supabase プロジェクト作成（`ohagi-0's coffee`、ref `gayhfwmvlxwyuzrvmkoy`、ap-northeast-1）、`0001_init.sql` を SQL Editor で適用、`.env.local` 設定、`src/types/database.ts` 生成（2026-09-21）
- [ ] Phase 0: Google OAuth のクライアント登録（Google Cloud）と Supabase Auth での有効化 — **ユーザー作業**。メールリンクの動作確認後でよい
- [ ] Phase 0: Supabase Auth の URL 設定（Site URL `http://localhost:3100` / Redirect URLs に `http://localhost:3100/auth/callback` と本番 URL、`coffeelog://auth/callback`）— **ユーザー作業**
- [ ] Phase 0: ローカル Supabase 用に Docker Desktop を導入（任意。クラウドだけで進めることも可）
- [ ] Phase 0: 実機（スマホ）でログイン → 空のホーム表示を確認して Phase 0 完了
- [ ] Phase 1 着手

進捗はこのチェックリストを更新して管理する。

### 8.1 実装上のメモ（Phase 0 で決めた細部）

- 認証ガードはミドルウェアではなく `(app)/layout.tsx` でクライアント側判定する（静的出力・Capacitor 対応のため）。`src/lib/supabase/middleware.ts` は作らない。
- `next.config.ts` に `output: 'export'` は付けていない（`/api/*` を同居させるため。ADR 0002）。
- shadcn/ui は Base UI ベース（`@base-ui/react`）。`Button` に `asChild` は無く、リンク化は `render={<Link href="…" />}` を使う。
- Supabase クライアントはシングルトンを遅延生成する（`getSupabaseBrowserClient()`）。モジュール直下で生成するとビルド時のプリレンダーで env 検証に失敗する。
- `pnpm db:types` はクラウドのプロジェクト（`--project-id gayhfwmvlxwyuzrvmkoy`）から生成する。Docker でローカル Supabase を動かす場合は `pnpm db:types:local`。
- 0001 は SQL Editor で手動適用したため `supabase_migrations` に記録が無い。`supabase link` して `db push` を使い始めるときは、先に `supabase migration repair --status applied 0001` で整合を取る。
- Prettier は Markdown を対象外（`.prettierignore`）。要件定義書・ADR の表を手書きのまま保つため。
- 画面設計モックは `docs/design/index.html`（単一 HTML、サンプルデータ）。GitHub Pages（main の `/docs`）で https://ohagi-0.github.io/coffeenotes/design/ に公開しており、push すると同じ URL で更新される。リポジトリは Pages のため public（2026-09-21）。デザインの変更はまずこのモックに反映し、基本設計書 `docs/DESIGN.md`（未作成）と整合させる。
