# coffeenotes — コーヒー記録アプリ

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
pnpm supabase start           # ローカル Supabase（Docker Desktop が必要）
pnpm db:migrate               # マイグレーション適用
pnpm db:types                 # src/types/database.ts を生成
pnpm dev                      # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test
```

Docker が無い場合はクラウドの Supabase プロジェクトを使う: ダッシュボードの SQL Editor で `supabase/migrations/0001_init.sql` を実行し、
`pnpm supabase gen types typescript --project-id <ref> > src/types/database.ts` で型を生成する。

## 現在のフェーズ

Phase 0（基盤）。進捗は CLAUDE.md §8 のチェックリストで管理する。
