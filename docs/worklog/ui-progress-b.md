# UI 作業ログ B（非 UI ウィンドウが引き受けた UI Issue）

`ui-progress.md` の補助。非 UI 側のチケット（#4〜#8）が終わったため、UI ウィンドウと**被らない番号**を選んで UI の Issue も進める。着手前に `ui-progress.md` の表に 🔧 と担当を書き、ここに詳細を残す。書式は `ui-progress.md` と同じ。

| Issue | 状態 | commit | 触ったパス |
|---|---|---|---|
| #13 UI-5 固有部品 | ✅ | (この commit) | `src/components/logs/rating-stars.tsx` `src/components/logs/ocr-field.tsx` `src/components/beans/taste-dots.tsx` `src/components/beans/taste-radar.tsx` `tests/unit/components/{rating-stars,taste-dots,taste-radar,ocr-field}.test.tsx` |

---

## #13 UI-5 固有部品 — ✅ 2026-09-22

UI ウィンドウが #11 を作業中だったので、依存の無い #13 を取った。新規ファイルだけを触り、`src/app/**` と既存部品には触っていない。

**やったこと**

- `RatingStars`（`src/components/logs/rating-stars.tsx`）: `value: number | null`、`size` は `sm | md | lg`（星 15 / 22 / 44px、数値 13 / 20 / 36px `font-num` 800）。`onChange` を渡すと入力モード。星の中に別のボタンは置かず、コンテナ 1 つが `role="slider"`（`aria-valuemin/max/now/text`）で、各星の左半分・右半分を透明な `<span data-star data-half>` で受ける。左半分で `.5`、右半分で `.0`、1 つ目の左半分は下限の 1.0。矢印キーで 0.5 ずつ、Home / End で 1.0 / 5.0。半分塗りは `clipPath`（`useId` で 1 コンポーネント 1 つ）。表示モードは `role="img"` + `aria-label="星評価 3.5 / 5"`。補助関数 `clampRating` / `formatRating` を export。
- `TasteDots`（`src/components/beans/taste-dots.tsx`）: `TASTE_AXES`（5 軸固定、`key` は `beans.taste_*` の列名に対応）、`TasteValues` 型、`EMPTY_TASTE` を export。表示は 20px の丸 + 右端に値または `—`。入力モードは各軸を `role="radiogroup"`、丸を `role="radio"`（`aria-label="Sweetness 3"`）にし、タップ領域は 40×44px（丸は 20px のまま）。同じ値をもう一度で `null`。`readOnly` で操作不可。
- `TasteRadar`（`src/components/beans/taste-radar.tsx`）: SVG 200×190、半径 80。座標はモックの値と一致（`radarPoint` / `radarPoints` を export、テストで検証）。`compare` を渡すと `--muted-foreground` の点線を重ねる。`null` は 0 として描き、ラベルは `—`。小数の平均は 1 桁で表示。左右のラベルが viewBox を超えるので `overflow-visible`。
- `OcrField`（`src/components/logs/ocr-field.tsx`）: `confidence < LOW_CONFIDENCE_THRESHOLD` で「要確認」タグ（琥珀地 10px 700）と入力欄の下に琥珀の点線（2px、間隔 5px）。中の input / textarea / select の change を `onChangeCapture` で拾って解除。`dirty` を渡せば外部制御（react-hook-form の `fieldState.isDirty`）が優先。`error` は `role="alert"` で錆色、`hint` も持てる。`isLowConfidence()` を export。
- テスト 22 件（`tests/unit/components/`）: 左右半分タップ・矢印キー・上下限、味覚チャートのトグルで null、レーダーの座標とラベル、要確認の表示と解除。

**決めたこと・注意**

- 星の `<input>` に `text-decoration` を当てても Chromium では内側の描画領域で切れて見えない。要確認の下線は入力欄の**枠の下辺**（`border-b-2 border-dotted border-warn`）で描く。
- `TasteDots` の入力モードは丸の間隔が表示モードより広い（タップ領域 44px を優先、P3）。同じ画面に両方を並べない前提。
- 色は `fill-primary` / `stroke-border` / `fill-primary/28` などトークンクラスだけ。hex の直書きなし。
- 確認は `src/app/preview-b/page.tsx` を一時的に置いて Playwright で 375px のスクリーンショットを撮った（削除済み、コミットしていない）。`.next/types/app/preview-b/` が残ると typecheck が落ちるので、一時ページを消したら `.next/types/app/<name>` も消す。

**他ウィンドウへの連絡**

- #15 の部品ページからは、`RatingStars`（3 サイズ + 入力）、`TasteDots`（表示 + 入力）、`TasteRadar`（単体 + `compare`）、`OcrField`（低信頼 / 高信頼 / error）を並べれば全バリアントが出ます。
- #20 の `BeanDetail` / `LogDetail` はこの 4 つをそのまま使えます。`TasteValues` は `beans` の `taste_*` 列をそのまま詰める形（`{ flavor: bean.taste_flavor, … }`）。
- 次は **#14 UI-6 表示系部品** を取る予定です（#12 は UI ウィンドウの番号順に近いので触りません）。被る場合は `ui-progress.md` の表で止めてください。
