# 0002: PWA 先行、後に Capacitor でネイティブ化

- 日付: 2026-09-21
- ステータス: 決定
- 関連要件: F-MISC-1、REQUIREMENTS.md §13

## 背景

初版はスマホ向け Web アプリ（PWA）として作るが、将来 App Store / Google Play で配信したい。書き直しを避けるため、今から守る設計制約を決める必要がある。

## 選択肢

1. 最初からネイティブ（React Native / Flutter）で作る
2. PWA で作り、要件が安定してから Capacitor で同じコードを包む
3. PWA のみで終える

## 決定

2 を採用。Phase 0〜5 は PWA として開発・運用し、Phase 6 で Capacitor により iOS / Android にラップする。以下の制約（REQUIREMENTS.md §13.2 N-1〜N-5）を最初から守る。

- N-1: 画面はすべてクライアント側で描画し、サーバーコンポーネントでデータ取得しない
- N-2: `/api/*` は `NEXT_PUBLIC_API_BASE_URL` を前置した絶対 URL で呼ぶ
- N-3: 認証リダイレクトをカスタムスキーム（`coffeelog://`）でも受けられるようにする
- N-4: ブラウザ API は `src/lib/platform/` のラッパー経由で呼ぶ
- N-5: 画像は Blob として扱う

補足: `/api/ocr` `/api/geo` を同一リポジトリに置くため、`next.config` に `output: 'export'` は現時点では設定しない。ネイティブ化時に API を分離するか、ビルド時フラグで切り替える。

## 理由

個人開発でスマホ向け UI を素早く回すには Web が最も速い。Capacitor は Web 資産をそのまま包めるため、制約を守っていれば追加コストが小さい。共有シート対応など PWA で足りない機能はネイティブ化の段階で補う。
