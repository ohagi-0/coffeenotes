# OCR テスト用フィクスチャ

- `sample-card-front.jpg` — 要件書のサンプル（KIELO COFFEE / Lusitania Lime Geisha）を模して HTML から生成した**合成画像**。実カードの写真ではない。
- `sample-card-front.recorded.json` — プロバイダ（Claude Haiku 4.5）の応答を録画したもの。`tests/unit/ocr/claude-provider.test.ts` が偽クライアントから返す。
  2026-09-24 に実 API で録画済み（`recorded: true`）。ツールの入力は「値はフラット + `confidence` オブジェクト」の形（`BEAN_CARD_TOOL`）。
  `sanitizeExtraction` がアプリ側の項目ごと `{ value, confidence }` に戻す。スキーマを変えたら録画し直す。

単体テストは実 API を叩かない（CLAUDE.md §5.4）。実 API での確認と録画は次で行う（ANTHROPIC_API_KEY が無ければ skip）。

```bash
ANTHROPIC_API_KEY=sk-ant-… pnpm vitest run tests/unit/ocr/live.test.ts
```
