# UI 作業ログ（Issues #9〜#24）

UI ウィンドウの進捗記録。**別ウィンドウ（非 UI）が作業前に読む用**。Issue ごとに「状態 / 触ったパス / 決めたこと / 他ウィンドウへの連絡」を書く。
古い順に上から並べる。着手順は Issue 番号順（#9 → #24）。同じワーキングツリーを共有しているので、非 UI 側は **ここに書かれたパスを触らない**。

凡例: ✅ 完了（push 済み） / 🔧 作業中 / ⏸ 待ち

**分担（2026-09-22 02:20 に UI ウィンドウ A が提案。B は `ui-progress-b.md` の主）**: 同じ Issue に二重着手しないよう、着手前に必ずこの表を見て 🔧 と担当を書く。
- **A（UI ウィンドウ、`src/app/**` の画面）**: #16 ログイン → #17 入力記録一覧 → #18 入口と豆フォーム → #19 店・評価・保存 → #22 設定 → #23 PC レイアウト
- **B（非 UI ウィンドウ、`src/components/**` の部品）**: #14 表示系部品 → #15 部品ページ → #20 詳細の部品 → #21 記録したお店
- #24 E2E は最後に A。空いた方が次の番号を取るときは表に書いてから。

| Issue | 状態 | commit | 触ったパス |
|---|---|---|---|
| #9 UI-1 トークン | ✅ | e743f47 | `src/app/globals.css` `src/app/layout.tsx` `src/components/providers.tsx` `public/manifest.json` |
| #10 UI-2 書体 | ✅ | 4dc1e97 | `src/app/layout.tsx` `src/app/globals.css` |
| #11 UI-3 レイアウトとナビ | ✅ | (次の commit) | `src/app/(app)/layout.tsx` `src/app/(app)/*/page.tsx`（タイトルのみ） `src/components/nav.ts` `site-header.tsx` `nav-drawer.tsx` `site-footer.tsx` `coming-soon.tsx` `bottom-nav.tsx`（削除） `tests/unit/components/nav.test.tsx` |
| #12 UI-4 入力系部品 | ✅ | (次の commit) | `src/components/app-button.tsx` `form/field.tsx` `filter-chips.tsx` `logs/place-segment.tsx` `wizard-stepper.tsx` `providers.tsx` `tests/unit/components/inputs.test.tsx` |
| #13 UI-5 固有部品 | ✅ 非 UI ウィンドウ（詳細は `ui-progress-b.md`） | 1f1863f | `src/components/logs/rating-stars.tsx` `src/components/logs/ocr-field.tsx` `src/components/beans/taste-dots.tsx` `src/components/beans/taste-radar.tsx` `tests/unit/components/{rating-stars,taste-dots,taste-radar,ocr-field}.test.tsx` |
| #14 UI-6 表示系部品 | ✅ 非 UI ウィンドウ（詳細は `ui-progress-b.md`） | 965b963 | `src/components/{empty-state,error-callout,row,date-group}.tsx` `src/components/beans/{card-image,bean-spec-grid,bean-detail-skeleton}.tsx` `src/components/logs/{log-list-item,log-list-item-skeleton}.tsx` `tests/unit/components/*` |
| #15 UI-7 部品ページ | ⏸ | | |
| #16 UI-8 ログイン | ✅ A | (次の commit) | `src/app/(auth)/login/page.tsx` `tests/e2e/login.spec.ts` |
| #17 UI-9 入力記録一覧 | ✅ A（段階 1 + 2） | (次の commit) | `src/app/(app)/page.tsx` `src/components/logs/log-timeline.tsx` `src/features/logs/presenters.ts` `tests/unit/components/log-timeline.test.tsx` `tests/unit/logs/presenters.test.ts` |
| #18 UI-10 入口と豆フォーム | ✅ A | e9f2809 | `src/app/(app)/logs/new/page.tsx` `src/components/logs/entry-option.tsx` `src/components/beans/bean-form.tsx` `src/components/wizard-stepper.tsx`（PHASE1_STEPS 追加） `src/features/logs/new-log-draft.ts` `tests/unit/components/bean-form.test.tsx` `tests/unit/logs/new-log-draft.test.ts` |
| #19 UI-11 店・評価・保存 | ⏸ | | |
| #20 UI-12 詳細の部品 | ⏸ 非 UI ウィンドウが次に取る予定（未着手。先に始めるならこの行を書き換えてください） | | |
| #21 UI-13 記録したお店 | ⏸ | | |
| #22 UI-14 設定 | ✅ A | (次の commit) | `src/app/(app)/settings/page.tsx` `src/components/settings/{setting-row,settings-view}.tsx` `src/features/settings/use-preferences.ts` `tests/unit/components/settings.test.tsx` |
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

## #10 UI-2 書体 — ✅ 2026-09-22

**やったこと**

- `src/app/layout.tsx`: `next/font/google` の `Bodoni_Moda`（`weight: 'variable'`, `axes: ['opsz']`）と `Manrope`（`weight: 'variable'`）を読み込み、`<html>` に `--font-bodoni` / `--font-manrope` を付けた。
- `src/app/globals.css`: `:root` に `--font-sans`（端末の日本語スタック）、`--font-display`（Bodoni + フォールバック）、`--font-num`（Manrope）を定義し、`@theme inline` に `--font-display` / `--font-num` を登録。`--font-mono`（Geist）は削除。`.font-display` にウェイト 500・字間 -0.02em・行間 .96・`font-optical-sizing: auto`、`.font-num` に `tabular-nums` を付けた。

**決めたこと・注意**

- 可変フォントに `axes` を付けるときは `weight: 'variable'` でないと next/font がエラーになる（`weight: ['500']` は不可）。ウェイトは CSS 側で指定する。
- 日本語の Web フォントは読み込まない。`font-sans` は端末フォント。

**使い方**

- 豆名・ワードマーク: `className="font-display text-[34px]"`（ウェイトは class 側で自動的に 500）
- 数字・日付・データ: `className="font-num font-semibold"`（`tabular-nums` は自動）

**他ウィンドウへの連絡**

- `docs/decisions/0007-detail-page-url-query-string.md` を作成中のようですが、**0007 は昨日の「PC は 3 列レイアウト・iOS は同じ UI」で使用済み**です（`docs/decisions/README.md` の一覧参照）。**0008** に振り直してください。
- `src/app/(app)/beans/[id]/.gitkeep` と `logs/[id]/.gitkeep` の削除がステージされたままです（Q6 の作業と思われます）。UI 側の commit は `git commit -- <自分のパス>` で行うので巻き込みません。

## #11 UI-3 共通レイアウトとナビ — ✅ 2026-09-22

**やったこと**

- `src/components/nav.ts`: ナビ定義の唯一の元（`NAV_ITEMS`、`ADD_LOG_HREF`、`isWizardPath`、`isActivePath`）。ラベルはページ名そのまま。`href` は `Route` 型（typedRoutes）。
- `site-header.tsx`: sticky 56px、ワードマーク（`font-display`）、「＋ 記録する」（銅のピル）、メニューボタン 44px。`variant="wizard"` で「やめる」。
- `nav-drawer.tsx`: ネイティブ `<dialog>` + `showModal()`。フォーカストラップ・Esc・top layer はブラウザ任せ。背景クリックで閉じる。ログアウトは `signOut()` → `/login`。
- `site-footer.tsx`: `bg-card` 地、5 ページへのリンク、著作権。
- `(app)/layout.tsx`: `BottomNav` を外し、ヘッダー + `main` + フッター + ドロワー。`main` の横余白は `px-5`（20px）に統一。ウィザード（`/logs/new`）ではフッターを出さない。`bottom-nav.tsx` は削除。
- 各ページの `<h1>` をページ名に統一（入力記録一覧 / 記録したお店 / 記録したお店のマップ / 好みの分析 / 記録を追加）。サイズは 24px（`text-2xl`）。
- `tests/unit/components/nav.test.tsx`: 8 件（ラベル、active 判定、ヘッダーの切り替え、ドロワーの項目・onClose・ログアウト・Esc）。jsdom は `<dialog>` の `showModal/close` を持たないので `beforeAll` でスタブ。

**決めたこと・注意**

- ヘッダーとフッターは `-mx-5` で `main` の余白を打ち消して画面端まで伸ばす。**ページ側は `px` を付けない**（layout が持つ）。
- ドロワー内の `<a>` は `onClick={onClose}` で閉じる。ルート変更の監視はしない。
- App Router では `_` で始まるフォルダはルートにならない（一時プレビューで `/_preview` が 404 だった）。開発用ページを作るときは `_dev` ではなく **`dev/`** のような名前にする（#15 に反映）。

**他ウィンドウへの連絡**

- 画面の URL は `src/lib/routes.ts`（ADR 0008）を使うので、以後 UI 側の `href` は `routes.*` に寄せます。`nav.ts` の `href` もそちらに合わせて差し替える予定（#17 以降）。

## #12 UI-4 入力系の共通部品 — ✅ 2026-09-22

**やったこと**

- `src/components/app-button.tsx` `AppButton`: Base UI の `Button` に cva でバリアントを載せた。`variant` = primary（銅）/ secondary / ghost / destructive / white、`size` = lg 52px / md 44px / sm 36px、`width` = full / auto。`loading` でスピナー + disabled + `aria-busy`。リンク化は `render={<Link href={…} />}`。`ui/button.tsx`（生成物）は触っていない。
- `src/components/form/field.tsx`: `Field`（ラベル 11px、`hint` / `error`。error は `role="alert"`）、`TextInput`（48px）、`Textarea`（最小 84px）、`Select`（48px）。React 19 なので react-hook-form の `register()` の `ref` はそのまま props で渡せる。
- `src/components/filter-chips.tsx` `FilterChips`: 制御コンポーネント（`value` / `onChange`）。`onOpenFilter` を渡すと先頭に銅枠の「絞り込み」。`-mx-5 px-5` で画面端まで横スクロール。
- `src/components/logs/place-segment.tsx` `PlaceSegment`: `role="radiogroup"`。値は `LogPlace`（`'shop' | 'home'`）。
- `src/components/wizard-stepper.tsx` `WizardStepper`: `current` と任意の `steps`。現在は `aria-current="step"`。
- `src/components/providers.tsx`: トーストを DESIGN.md §4 の見た目に（クレマ地・エスプレッソ文字・3 秒・成功は緑のチェック）。
- `tests/unit/components/inputs.test.tsx`: 7 件。

**使い方**

- 主ボタン: `<AppButton>保存する</AppButton>`。二次: `variant="secondary"`。破壊: `variant="destructive"`（必ず確認を挟む）。
- 入力: `<Field label="豆名" htmlFor="name" error={errors.name?.message}><TextInput id="name" aria-invalid={!!errors.name} {...register('name')} /></Field>`
- 成功トースト: `toast.success('保存しました')`（ボタンと同じ動詞で）。

**注意**

- `.next/types/app/<消したルート>/` が残ると `pnpm typecheck` が落ちる（dev サーバーが生成した型が古いまま）。ルートを消したら `.next/types/app/<そのルート>` も消す。

## #16 UI-8 ログイン — ✅ A 2026-09-22

**やったこと**

- `src/app/(auth)/login/page.tsx`: DESIGN.md §5 S1 の構成に作り直した。ワードマーク（`font-display` 64px）を `mt-auto` で画面下寄せ、タグライン、「Google で続ける」（`AppButton variant="white"` + G マーク）、メール入力（`Field` + `TextInput`）、「ログインリンクを送る」（`variant="secondary"`）、注記。
- 状態: 送信中（`loading`）、送信完了（フォームを「リンクを送りました。メールを開いてください」のカードに置き換え。「同じメールにもう一度送る」「別のメールアドレスを使う」）、失敗（錆色のコールアウト。#14 の `ErrorCallout` ができたら差し替える）。
- `tests/e2e/login.spec.ts`: 見出し `Coffeenotes`、ボタン `Google で続ける` / `ログインリンクを送る` に合わせ、空送信のバリデーションを 1 本追加。

**注意**

- Playwright で `getByRole('alert')` は Next.js のルートアナウンサー（`#__next-route-announcer__`）にも一致する。`filter({ hasText })` で絞ること。
- `h1` は `<br>` で 2 行にしているので `aria-label="Coffeenotes"` を付けた（E2E の `getByRole('heading', { name })` 用）。

## #22 UI-14 設定 — ✅ A 2026-09-22

**やったこと**

- `src/components/settings/settings-view.tsx` `SettingsView`（props 駆動）: アカウント行（頭文字アバター、メール、ログイン方式）、「読み取り」（今日の回数 `n / 50` + 進捗バー、Phase 2 まで 0 と注記）、「表示」（星の入力: タップ / スライダー）、「データ」（CSV / JSON は disabled、位置情報の説明）、「アカウント」（ログアウト）、最下部に破壊ボタン「アカウントと全データを削除」（押すと「削除はまだ使えません」の説明。実処理は F-AUTH-3 の別 Issue）。
- `src/components/settings/setting-row.tsx` `SettingRow` / `SettingSection`: ラベル + 現在値 + 右要素（chevron）、`note` で下に 1 文。
- `src/features/settings/use-preferences.ts` `useRatingInputMode()`: 星の入力方法を localStorage（`coffeenotes:rating-input`）に保存。`useSyncExternalStore` で同期、読めない環境では `tap`。**`RatingStars` 側のスライダー表示はまだ無い**（#19 で `mode` を渡して接続する想定。B の `RatingStars` に `variant` を足すか要相談）。
- `src/app/(app)/settings/page.tsx`: セッションから email と `app_metadata.providers` を渡し、ログアウトをつなぐ。
- テスト 4 件。表示はプレビューで確認（375px、エラーなし）。

**他ウィンドウへの連絡**

- `src/features/settings/` を新設しました（非 UI の `src/features/**` の領域ですが、端末設定の hook なので UI 側で持ちます）。

## #17 UI-9 入力記録一覧 — ✅ A 2026-09-22（段階 1 + 2 を同時に）

B の #14（ログ行・日付見出し・空状態・失敗表示・スケルトン）と非 UI の `useLogs` / `useMonthlyLogCount` / `useBeanFilterOptions` が揃っていたので、見た目とデータ接続を一度に入れた。

**やったこと**

- `src/features/logs/presenters.ts`: `toTimelineItem(log)`（DB 行 → `LogListItemProps` + `loggedOn`）、`formatLogDetail`（店は飲み方だけ、自宅は 器具 · 1:15 · 92 ℃）、`formatBrewRatio`、`groupByDate`、`chipToFilters`（`?f=` の値 → `LogFilters`）。すべて純関数でテスト 5 件。
- `src/components/logs/log-timeline.tsx` `LogTimeline`: 読み込み（`LogListSkeleton`）/ 失敗（`ErrorCallout` + 再試行）/ 空（「まだ記録がありません」+「最初の記録を追加」）/ 絞り込み 0 件（「条件に合う記録はありません」+ 解除）/ 一覧（`DateGroup` + `LogListItem`）の 5 状態。テスト 4 件。
- `src/app/(app)/page.tsx`: 見出し + 今月の杯数、検索欄（Phase 5 まで見た目だけ、「準備中」）、`FilterChips`（すべて / 星 4 以上 / 自宅 / 店で + 自分の豆に出てくる生産国・精製を最大 4 つずつ）、`LogTimeline`。絞り込みは URL の `?f=` に持ち `router.replace`（`useSearchParams` は `Suspense` の中、ADR 0008）。
- カード画像の URL は Phase 2（署名付き URL）まで `null`。それまでは `CardImage` の印刷物風プレースホルダが出る。

**他ウィンドウへの連絡**

- `LogListItem` に `loggedOn` を含むオブジェクトをそのままスプレッドしています（DOM には流れない）。props を DOM に流す変更をするなら `loggedOn` を除いてください。
- 「絞り込み」の詳細シート（`onOpenFilter`）は Phase 1 では出していません。

## #18 UI-10 記録作成の入口と ②豆フォーム — ✅ A 2026-09-22

**やったこと**

- `src/app/(app)/logs/new/page.tsx`: 段階を URL の `?step=` に持つ（なし = 入口 / `bean` = ② / `place` = ③）。入口は「手で入力する」（主候補）「登録済みの豆から」の 2 択 + 「最近の豆」3 件（`useBeans`）。「カードを撮る」は Phase 2 で先頭に足す。③は #19 まで案内文だけ。
- `src/components/logs/entry-option.tsx` `EntryOption`: 角丸 18px、左に 48px のアイコン地。`href` か `onClick`。
- `src/components/beans/bean-form.tsx` `BeanForm`: `beanFormSchema` から `roaster_id` を外し `roaster_name` + `roaster_id (nullable)` にした resolver。ロースターは `roasterOptions` / `onRoasterSearch` で候補を出し、選べば id 付き、選ばなければ **新規ロースター（id null）** として `onSubmit` に渡す。フレーバーはタグ入力（追加 / Enter / × / 重複除去）、味覚チャートは B の `TasteDots`。数値は `type="number"` + スキーマの `numberOrNull` で数値化。`defaultValues` に OCR 結果を流せる形（Phase 2）。
- `src/features/logs/new-log-draft.ts`: ②の内容を sessionStorage に置く。**豆は③の「保存する」まで DB に作らない**（途中でやめても孤児の豆を残さない）。③で `roaster.id` が null なら `createRoasterWithDedupe` で登録してから `useCreateBean` → `useCreateLog` の順に保存する（#19）。
- テスト 7 件（必須エラー、数値化、候補選択、フレーバー、味覚チャート、下書き）。

**他ウィンドウへの連絡**

- `PHASE1_STEPS`（豆 / 店と評価）を `wizard-stepper.tsx` に足しました。Phase 2 で `WIZARD_STEPS` に戻します。
- Next.js の page ファイルからは default 以外を export できません（`.next/types` の型検査で落ちる）。定数や純関数は別モジュールへ。
- 価格欄は 375px で 2 列だと切れるので 1 行に独立させました（e9f2809 の次の commit）。
