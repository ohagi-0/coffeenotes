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
cp .env.example .env.local   # 値を埋める
pnpm supabase start           # ローカル Supabase（Docker）
pnpm dev                      # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test
```

## 現在のフェーズ

Phase 0（基盤）。進捗は CLAUDE.md §8 のチェックリストで管理する。
