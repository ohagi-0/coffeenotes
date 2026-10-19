# 0011 店の検索と地図を Google Maps Platform に移行する

日付: 2026-10-19

## 背景

ADR 0010 で OSM のまま店名検索を作り直したが、本番で確かめると次の弱さが残った（2026-10-19）。

- 周辺の店をまとめて取る Overpass が、本家・予備とも長時間応答しない日があった（この日は終日）。その間は Photon の 50 件に減り、カタカナから英字名の店に当たる力が落ちる。
- OSM に載っていない個人店は出ない。日本のカフェの網羅性は Google が最も高い。

Kota が Google Places を使う方針を決めた（2026-10-19）。ただし Google の規約には次の縛りがあり（Google Maps Platform Service Specific Terms、2026-10-15 改定、14 条「Places API」）、店候補だけを差し替えることはできない。

- 14.2: Places の結果（Google Maps Content）を Google 以外の地図と一緒に使ってはいけない。
- 14.3: Places から取った緯度経度は、一時的に 30 日まで保存してよい。その後は消す。
- 共通 3 条: 店の ID（place_id）だけは期限なく保存してよい。
- Places API ポリシー: 地図を出さずに結果を表示するときは Google Maps のロゴ（または「Google Maps」の文字）を付ける。地図に出すときは Google マップに出す。

## 選択肢

| 案 | 内容 | 評価 |
|---|---|---|
| A. 地図ごと Google に替える | 地図を Google Maps JavaScript API に、店候補を Places API (New) に。Google から取った店は ID を永続化し、名前・住所・座標は 30 日以内に更新する | 規約どおり。作り替えの範囲は広い（地図、店データの持ち方、書き出し、オフライン） |
| B. 地図は OSM のまま、Google は候補だけ | 選んだ店の名前・住所を写して保存し、位置は住所から OSM で引く | 手軽だが、Google の名前・住所を保存して OSM の地図に出すことになり、規約上は灰色。公開アプリなので採らない |
| C. OSM のまま（ADR 0010） | 現状維持 | 公開サーバーの可用性と網羅性に不安が残る |

## 決定

A を採る。

- **地図**: Google Maps JavaScript API（`@vis.gl/react-google-maps`、Map ID + AdvancedMarker）。Leaflet + OSM タイルは置き換える。環境変数 `NEXT_PUBLIC_MAP_PROVIDER=google|osm` で戻せるようにし、移行完了後に OSM の地図コードを消す。
- **店候補**: Places API (New) をサーバー（`/api/geo`）から呼ぶ `GeoProvider` の Google 実装。
  - 開いたとき: Nearby Search（`includedTypes: cafe, coffee_shop`、Pro SKU、月 5,000 回まで無料）
  - 入力中: Autocomplete (New)（`origin` で距離つき、セッショントークン、Essentials SKU、月 10,000 回まで無料）
  - 選んだとき: Place Details（`id, displayName, formattedAddress, shortFormattedAddress, location`、Pro SKU、月 5,000 回まで無料）
- **店データの持ち方**: `shops` に `place_provider`（`google` / `osm` / NULL = 手入力）と `place_synced_at` を足す。Google の店は `external_place_id` に place_id を入れて永続化し、名前・住所・座標は 30 日以内に Place Details で更新する「一時的な写し」として扱う。更新は週 1 回の GitHub Actions（`/api/places/refresh`）と、店詳細を開いたときの遅延更新で行う。
- **手入力の店**: 変えない。住所からの位置づけは Nominatim のまま（Google の内容を含まないので保存の制限を受けない）。
- **既存の OSM 由来の店**: そのまま残し、Google マップに出す（Google マップに Google 以外の内容を出すのは可）。OSM のデータを表示するのでフッターに「© OpenStreetMap contributors」を出す。
- **書き出し**: Google の店は店名と Google マップへのリンク（place_id）だけを出し、住所・座標は出さない。
- **オフライン**: Google の地図・API はキャッシュしない。オフライン時は地図を「オフラインでは出せません」にし、店の一覧は Supabase のキャッシュで出す。
- **鍵**: サーバー用（Places API (New) だけ許可）とブラウザ用（Maps JavaScript API だけ許可、HTTP リファラー制限）の 2 つ。Cloud の予算アラートを月 500 円で設定する。

## 理由

- 日本の店の網羅性が最も高く、入力途中の語でも当たる。
- 無料枠（地図 10,000 表示、Nearby 5,000、Autocomplete 10,000、Details 5,000 の各月）は、数十ユーザーなら余裕がある。見積り: 30 人 × 月 20 回の検索シート = Nearby 600、Autocomplete 3,000、Details 600、地図表示 900、30 日更新 300。
- 規約を守る形にするには地図も Google にする必要があり、そのぶん作り替えが大きい。Kota が了承した。

## 残る課題

- Google の店の名前・住所・座標は 30 日で更新が要る。更新ジョブが止まると規約違反の状態になるので、失敗を通知する。
- 書き出しに店名を含めるかは灰色（店名も Google の内容）。利用者自身の記録の一部として店名だけ出す判断にした。
- Capacitor 版では WebView の参照元（`capacitor://localhost` など）をブラウザ用キーの許可リストに足す。

## 出典（2026-10-19 確認）

- Google Maps Platform Service Specific Terms（2026-10-15 改定）: https://cloud.google.com/maps-platform/terms/maps-service-terms
- Places API ポリシー（place_id は無期限に保存可、地図なしの表示には Google Maps のロゴ）: https://developers.google.com/maps/documentation/places/web-service/policies
- 料金（2025-03-01 以降の SKU ごとの無料枠）: https://developers.google.com/maps/billing-and-pricing/pricing
- Place Details (New) の項目と SKU: https://developers.google.com/maps/documentation/places/web-service/place-details
