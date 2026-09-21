# coffeenotes — コーヒー記録アプリ

本番: https://coffee-notes.app

飲んだコーヒー豆をテイスティングカードの写真から半自動で記録し、店・星評価・タグと紐づけて一覧 / 検索 / 地図 / 統計で振り返るスマホ向け PWA。

- 要件定義: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)（正）
- 開発ルール: [CLAUDE.md](CLAUDE.md)
- 決定記録（ADR）: [docs/decisions/](docs/decisions/)

## 技術スタック

Next.js 15 (App Router) + TypeScript / Tailwind CSS + shadcn/ui / Supabase / Claude Haiku 4.5 Vision (OCR) / react-leaflet + OpenStreetMap / Vercel

## 開発

```bash
pnpm install
cp .env.example .env.local   # Supabase の URL / anon key などを埋める
pnpm db:types                 # クラウドの Supabase から src/types/database.ts を生成
pnpm dev                      # http://localhost:3100（3000 は他プロジェクトと衝突するため固定）
pnpm lint && pnpm typecheck && pnpm test
```

Docker が無い場合はクラウドの Supabase プロジェクトを使う: ダッシュボードの SQL Editor で `supabase/migrations/0001_init.sql` を実行し、
`pnpm supabase gen types typescript --project-id <ref> > src/types/database.ts` で型を生成する。

## 開発用サンプルデータ

`.env.local` に `SUPABASE_SERVICE_ROLE_KEY`（Supabase ダッシュボード → Settings → API Keys）を入れてから、自分のメールアドレスを指定して実行する。
投入先の URL を表示して確認を挟むので、本番プロジェクトに繋がっていないか必ず見ること。

```bash
pnpm seed:dev -- --email you@example.com --reset   # --reset は自分の既存データを消してから入れ直す
```

記録 15 件・豆 6 件・店 4 件・タグ 5 種が入る。行の ID はユーザー ID から決まるため、何度実行しても増えない。画像は入らない。

## 現在のフェーズ

Phase 1（手入力 MVP）。Phase 0（基盤）は 2026-09-21 に完了。進捗は CLAUDE.md §8 のチェックリストで管理する。
