# UI 作業ログ（Issues #9〜#24）

UI ウィンドウの進捗記録。**別ウィンドウ（非 UI）が作業前に読む用**。Issue ごとに「状態 / 触ったパス / 決めたこと / 他ウィンドウへの連絡」を書く。
古い順に上から並べる。着手順は Issue 番号順（#9 → #24）。同じワーキングツリーを共有しているので、非 UI 側は **ここに書かれたパスを触らない**。

凡例: ✅ 完了（push 済み） / 🔧 作業中 / ⏸ 待ち

| Issue | 状態 | commit | 触ったパス |
|---|---|---|---|
| #9 UI-1 トークン | ✅ | (下記) | `src/app/globals.css` `src/app/layout.tsx` `src/components/providers.tsx` `public/manifest.json` |
| #10 UI-2 書体 | ⏸ | | |
| #11 UI-3 レイアウトとナビ | ⏸ | | |
| #12 UI-4 入力系部品 | ⏸ | | |
| #13 UI-5 固有部品 | ⏸ | | |
| #14 UI-6 表示系部品 | ⏸ | | |
| #15 UI-7 部品ページ | ⏸ | | |
| #16 UI-8 ログイン | ⏸ | | |
| #17 UI-9 入力記録一覧 | ⏸ | | |
| #18 UI-10 入口と豆フォーム | ⏸ | | |
| #19 UI-11 店・評価・保存 | ⏸ | | |
| #20 UI-12 詳細の部品 | ⏸ | | |
| #21 UI-13 記録したお店 | ⏸ | | |
| #22 UI-14 設定 | ⏸ | | |
| #23 UI-15 PC レイアウト | ⏸ | | |
| #24 UI-16 E2E | ⏸ | | |

---

## #9 UI-1 トークン — ✅ 2026-09-22

**やったこと**

- `src/app/globals.css`: `:root` を DESIGN.md §2.1 の hex に置き換え。`.dark` ブロックと `@custom-variant dark` を削除。`html { color-scheme: dark }` を固定。`--radius` を `0.875rem`（14px）に。
- 固有色を `--ok` `--warn` `--card-paper` `--card-ink` `--pin-45/40/35/30` `--map-me` `--primary-hover` として定義し、`@theme inline` に `--color-*` で登録した。Tailwind では `bg-ok` `text-warn` `bg-card-paper` `text-pin-45` `hover:bg-primary-hover` のクラスで使える。
- `src/app/layout.tsx`: `themeColor` → `#17120f`、`appleWebApp.statusBarStyle` → `black-translucent`。
- `public/manifest.json`: `theme_color` / `background_color` → `#17120f`。
- `src/components/providers.tsx`: `<Toaster theme="dark">` を明示。`ui/sonner.tsx`（生成物）は `next-themes` の `useTheme` を使っているが、Provider が無いので既定は `system`。OS がライトだとトーストだけ白くなるため、props で `dark` を上書きした。`next-themes` の依存は残す（生成物が import しているため）。

**決めたこと・注意**

- shadcn の変数名（`--primary` など）にそのまま載せた。独自名（`--cu` など）は CSS 側では作らず、DESIGN.md の名前は「意味」として読む。対応表は DESIGN.md §2.1。
- `--input` は `--card` と同じ `#211a15`（入力欄の地）。`--border` は `#3b2f26`。
- `pnpm build` は **実行していない**。非 UI ウィンドウの dev サーバー（3100）が `.next/` を使っている最中に build すると壊れるため。lint / typecheck / 起動中サーバーのスクリーンショットで確認した。

**他ウィンドウへの連絡**

- 色は Tailwind のトークンクラスで使ってください。hex の直書きはしない。
- `dark:` バリアントはもう効きません（`@custom-variant dark` を消した）。生成物の `ui/*.tsx` に残っている `dark:` クラスは無視されるだけで害はない。

**確認方法**

- `pnpm dev` → `/login` が Espresso 地（`rgb(23,18,15)`）・Crema 文字になっている。
