# ADR（Architecture Decision Records）

決めたことを 1 ファイル 1 決定で残す。ファイル名は `NNNN-title.md`（例: `0001-ocr-claude-haiku.md`）。
外部サービスの料金・仕様に依存する判断は、確認した日付と出典を添える（CLAUDE.md §7-8）。

## テンプレート

```markdown
# NNNN: タイトル

- 日付: YYYY-MM-DD
- ステータス: 決定 | 提案 | 廃止（→ NNNN に置き換え）
- 関連要件: F-XXX-n

## 背景

## 選択肢

## 決定

## 理由
```

## 一覧

| # | タイトル | ステータス |
|---|---|---|
| [0001](0001-ocr-claude-haiku.md) | OCR エンジンは Claude Haiku 4.5 Vision | 決定 |
| [0002](0002-pwa-first-then-capacitor.md) | PWA 先行、後に Capacitor でネイティブ化 | 決定 |
| [0003](0003-shop-manual-input-and-map-tap.md) | 店の手入力 + 地図タップでの位置指定を Must | 決定 |
| [0004](0004-rating-half-star.md) | 星評価は 0.5 刻み | 決定 |
| [0005](0005-roaster-shared-master.md) | ロースター名は全ユーザー共通マスタ | 決定 |
| [0006](0006-visual-design-dark-copper-bodoni.md) | ビジュアルデザインはダーク専用・銅アクセント・Bodoni Moda + Manrope | 決定 |
| [0007](0007-desktop-layout-and-ios-adaptation.md) | PC は 3 列レイアウトで「振り返る」、iOS は同じ UI に OS の作法だけ足す | 決定 |
| [0008](0008-detail-page-url-query-string.md) | 詳細ページの URL はクエリ文字列（`/beans?id=…`）。静的出力で `[id]` が使えないため | 決定 |
